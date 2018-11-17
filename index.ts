/* Execute With:

    npm run build
    node build/index.js

    OR

    npm run exec
*/

type Operation = "mult" | "div" | "add" | "sub";
type ParenToken = { kind: "paren"; value: "open" | "close", origvalue: string };
type OpToken = { kind: "op"; value: Operation, origvalue: string };
type NumToken = { kind: "number"; value: number, origvalue: string };
type Token = OpToken | NumToken | ParenToken;

const whitespace = /\s+/;
const number = /[0-9]+/;
const operator = /[+*/\-]/

const tuple = <T extends any[]>(...a: T) => a

const replace = (str: string, match: string, replace: string): string =>
  str === match ? replace : str

const lexer = (input: string): Token[] => {
  const split = input
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .split(/\s+/)
    .filter(x => x != '');
  const output: Token[] = []

  for (const str of split) {
    const origvalue = str
    if (number.test(str))
      output.push({ kind: "number", value: parseInt(str, 10), origvalue });
    else if (str === '+' || str === '-' || str === '*' || str === '/') {
      const kind = 'op'
      switch (str) {
        case '*':
          output.push({ kind, value: 'mult', origvalue })
          break;
        case '+':
          output.push({ kind, value: 'add', origvalue })
          break;
        case '-':
          output.push({ kind, value: 'sub', origvalue })
          break;
        case '/':
          output.push({ kind, value: 'div', origvalue })
          break;
      }
    } else if (str === ')' || str === '(')
      output.push({ kind: 'paren', value: str === '(' ? 'open' : 'close', origvalue })
    else {
      throw new Error(`Unexpected token ${str}`)
    }
  }

  return output
};

type AST = any

const parser = (tokens: Token[]): AST => {

}

const execute = (ast: AST): string => {}

const firstinput = "(* 7 (+ 5 6))";
const invalidinput = "(* 7 (+ % 6))";
console.log(lexer(firstinput))
console.log(lexer(invalidinput))
// Example final process:
// console.log(execute(parser(lexer(input))))