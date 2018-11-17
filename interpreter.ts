import { and, Refinement } from "./util";

/* Execute With:

    npm run build
    node build/index.js

    OR

    npm run exec
*/

type Operation = "mult" | "div" | "add" | "sub";
type OpenParen = { kind: "paren"; value: "open"; origvalue: string };
type CloseParen = { kind: "paren"; value: "close"; origvalue: string };
type ParenToken = OpenParen | CloseParen;
type OpToken = { kind: "op"; value: Operation; origvalue: string };
type NumToken = { kind: "number"; value: number; origvalue: string };
type Token = OpToken | NumToken | ParenToken;

const printToken = (tok: Token) => {
  switch (tok.kind) {
    case "number":
      return `Number(${tok.value})`;
    case "paren":
      return tok.origvalue;
    case "op":
      return `Operation(${tok.value})`;
  }
};

const whitespace = /\s+/;
const number = /[0-9]+/;
const operator = /[+*/\-]/;

const lexer = (input: string): Token[] => {
  const split = input
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .split(/\s+/)
    .filter(x => x != "");
  const output: Token[] = [];

  for (const str of split) {
    const origvalue = str;
    if (number.test(str))
      output.push({ kind: "number", value: parseInt(str, 10), origvalue });
    else if (str === "+" || str === "-" || str === "*" || str === "/") {
      const kind = "op";
      switch (str) {
        case "*":
          output.push({ kind, value: "mult", origvalue });
          break;
        case "+":
          output.push({ kind, value: "add", origvalue });
          break;
        case "-":
          output.push({ kind, value: "sub", origvalue });
          break;
        case "/":
          output.push({ kind, value: "div", origvalue });
          break;
      }
    } else if (str === ")" || str === "(")
      output.push({
        kind: "paren",
        value: str === "(" ? "open" : "close",
        origvalue
      } as OpenParen | CloseParen);
    else {
      throw new Error(`Unexpected token ${str}`);
    }
  }

  return output;
};

const arrayReadFun = <T>(arr: T[]) => {
  const iter = arr[Symbol.iterator]();
  return () => iter.next().value || null;
};

class Reader<T> {
  private buffer: T[] = [];
  private inputFinished = false;
  constructor(private readFun: () => T | null) {}
  get done() {
    return this.buffer.length === 0 && this.inputFinished;
  }
  peek(k = 1) {
    if (k > this.buffer.length) {
      let count = k;
      let val: T | null = null;

      while (
        count > 0 &&
        !this.inputFinished &&
        null !== (val = this.readFun())
      ) {
        this.buffer.push(val);
        count--;
      }

      if (val === null) {
        this.inputFinished = true;
      }
    }

    return this.buffer.slice(0, k);
  }
  read() {
    if (this.buffer.length > 0) {
      return this.buffer.shift();
    }

    const value = this.readFun();

    if (value === null) {
      this.inputFinished = true;
    }

    return value || undefined;
  }
}

type AST =
  | { kind: "literal"; value: number }
  | { kind: "op"; op: Operation; left: AST; right: AST };
type Program = { kind: "program"; expressions: AST[]; symboltable: {} };

const isNum = (tok: Token): tok is NumToken => tok.kind === "number";
isNum.errorString = "Expected Number, but recieved";

const isParen = (tok: Token): tok is ParenToken => tok.kind === "paren";
isParen.errorString = "Expected Paren, but recieved";

const isOpenparen = (tok: Token): tok is OpenParen =>
  isParen(tok) && tok.value === "open";
isOpenparen.errorString = "Expected `(`, but recieved";

const isCloseparen = (tok: Token): tok is OpenParen =>
  isParen(tok) && tok.value === "close";
isCloseparen.errorString = "Expected `)`, but recieved";

const isOp = (tok: Token): tok is OpToken => tok.kind === "op";
isOp.errorString = "Expected Operation, but recieved";

const parser = (tokens: Token[]): Program => {
  const reader = new Reader(arrayReadFun(tokens));
  const output: Program = { kind: "program", expressions: [], symboltable: {} };
  let lookahead = reader.peek()[0] as Token | undefined;

  if (typeof lookahead === "undefined") {
    throw new SyntaxError("Unexpected end of input");
  }

  const program = () => {
    // program is a list of sexp
    while (true) {
      if (lookahead && (isOpenparen(lookahead) || isNum(lookahead))) {
        output.expressions.push(sexp());
        continue;
      } else {
        break;
      }
    }
  };

  const sexp = (): AST => {
    if (lookahead && isNum(lookahead)) return num();
    match(isOpenparen);
    const op = match(isOp);
    // this recursive call will blow the stack if it's too deep
    const exp1 = sexp();
    const exp2 = sexp();
    match(isCloseparen);
    return { kind: "op", op: op.value, left: exp1, right: exp2 };
  };

  const num = (): AST => {
    const val = match(isNum);
    return { kind: "literal", value: val.value };
  };

  const match = <B extends Token>(
    p: Refinement<Token, B> & { errorString?: string }
  ): B => {
    if (lookahead && p(lookahead)) {
      const old = lookahead;
      reader.read();
      lookahead = reader.peek()[0];
      return old;
    } else {
      const tokString = (lookahead && printToken(lookahead)) || "No Input";

      throw SyntaxError(
        p.errorString
          ? p.errorString + ` ${tokString}`
          : `${tokString} did not fulfill predicate ${p.name || p}`
      );
    }
  };

  program();
  if (!reader.done) throw new SyntaxError("Unexpected end of input");

  return output;
};

const execute = (prog: Program, context?: {}): any => {
  return prog;
};

export const interpreter = (
  input: string,
  context?: {},
  level: "ast" | "tokens" | "eval" = "eval"
) => {
  const tokens = lexer(input);
  if (level === "tokens") return tokens;
  const ast = parser(tokens);
  if (level === "ast") return ast;
  return execute(ast);
};

// console.log(parser(lexer("(+ 1 2) (- 3 4) (* 7 (+ 5 6))")));
// const firstinput = "(* 7 (+ 5 6))\n(+ 8 9)"; // > 77 \n 17
// const invalidinput = "(* 7 (+ % 6))";
// console.log(lexer(firstinput))
// console.log(lexer(invalidinput))
// Example final process:
// console.log(execute(parser(lexer(input))))
