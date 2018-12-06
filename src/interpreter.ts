import { Refinement, Reader, arrayReadFun, symDesc } from './util'
import {
  Token,
  SymToken,
  NumToken,
  ParenToken,
  OpenParen,
  printToken,
  lexer,
  StringToken,
  CloseParen,
  isString,
  isNum,
  isSymbol,
  isDotDelim,
  isQuote,
} from './lexer'
import { or } from './match/functional'
import { Cons, listToIterable, consProper, cons, isCons } from './Cons'
import { nil, symboltable, isNil, symExpr, evalFn, SymbolTable } from './symboltable'

/* Execute With:

    npm run build
    node build/index.js

    OR

    npm run exec
*/

// const validateLambdaList = (l: SExpr) => {
//   if (allSymbolExpr(l)) {
//     let hitRest = false
//     let nextIsRest = false
//     const output = [] as Array<{ name: string, rest?: boolean }>
//     for (const sym of l) {
//       // if we already had a rest parameter and the next one is not the parameter name
//       // i.e. we tried to provide a param after a rest param: (defun test (a &rest b c) c)
//       if (!nextIsRest && hitRest) {
//         throw new SyntaxError(`lambda list element ${sym.value} is superfluous. Only one variable is allowed after ${REST_SYM}`)
//       }
//       if (sym.value === REST_SYM) {
//         // if we provide multiple rest paramters: (defun test (a &rest b &rest c) c)
//         if (hitRest) {
//           throw new SyntaxError(`lambda list marker ${REST_SYM} not allowed here`)
//         }
//         nextIsRest = true
//         hitRest = true
//         continue
//       }
//       if (nextIsRest) {
//         output.push({ name: sym.value, rest: true })
//         nextIsRest = false
//         continue
//       }
//       output.push({ name: sym.value })
//     }
//     // we had a rest parameter, but the name was not provided. i.e. (defun test (a &rest) a)
//     if (nextIsRest) {
//       throw new SyntaxError(`missing ${REST_SYM} parameter in lambda list`)
//     }
//     return output
//   }
//   return []
// }

export type SExpression =  string | number | symbol | Cons

export const printExpression = (val: SExpression): string => {
  if (typeof val === 'string') return `"${val}"`
  if (typeof val === 'number') return String(val)
  // TODO: handle special symbol names (like escaped chars)
  // clisp prints symbol names that required escaping surrounded by |
  // e.g. '\ a\ b\ c is printed as | a b c|
  if (typeof val === 'symbol') return symDesc(val) || '[Unknown Symbol]'
  if (isCons(val)) {
    // to match the printing that clisp does
    // we print as list until last cons
    // if cdr is not nil, i.e. val is an improper list
    // we print a . and then cdr
    let str = '('
    const consArr = [...listToIterable(val)]
    for (let i = 0; i < consArr.length; ++i) {
      const car = consArr[i]
      if (i === consArr.length - 1 && !isNil(car)) {
        // TODO: find a way to remove recursion here
        str += ` . ${printExpression(car)}`
      } else if (i === consArr.length - 1) {
        break
      } else {
        str += `${str === '(' ? '' : ' '}${printExpression(car)}`
      }
    }
    str += ')'
    return str
  }
  return val
}

const isParen = (tok: Token): tok is ParenToken => tok.kind === 'paren'

const isOpenparen = (tok: Token): tok is OpenParen =>
  isParen(tok) && tok.value === 'open'
  isOpenparen.matches = '(' as '('

const isCloseparen = (tok: Token): tok is CloseParen =>
  isParen(tok) && tok.value === 'close'
  isCloseparen.matches = ')' as ')'

const quoteSexpr = (e: SExpression) => cons(symExpr('quote'), consProper(e))

const isAtom = (e: Token): e is StringToken | NumToken | SymToken =>
  e.kind === 'string'
  || e.kind === 'number'
  || e.kind === 'symbol'

const sExprEntrySet = or(isOpenparen, isAtom, isQuote)

const expectingSyntaxError = (expecting: string, lookahead?: Token) => {
  const tokString = (lookahead && printToken(lookahead)) || "ε"
  return new SyntaxError(
    `Expected ${expecting} but recieved ${tokString} at ${lookahead ? lookahead.line + ':' + lookahead.column : 'EOF'}`
  )
}

const parser = (toks: Token[]) => {
  const reader = new Reader(arrayReadFun(toks))
  let lookahead = reader.peek()[0] as Token | undefined

  const program = () => {
    const output: SExpression[] = []
    while (true) {
      if (lookahead && (sExprEntrySet(lookahead))) {
        output.push(sexp())
      } else {
        break
      }
    }
    return output
  }

  const sexp = (): SExpression => {
    if (lookahead) {
      if (isQuote(lookahead)) return qte()
      if (isNum(lookahead)) return num()
      if (isString(lookahead)) return str()
      if (isSymbol(lookahead)) return sym()
    }
    match(isOpenparen)
    if (lookahead && isCloseparen(lookahead)) {
      // the empty list or nil
      match(isCloseparen)
      return nil
    }
    const first = sexp()
    return list(first)
  }

  const list = (first?: SExpression): Cons => {
    if (!first) {
      match(isOpenparen)
      first = sexp()
    }
    let head = consProper(first)
    let pointer = head
    while (lookahead && !isCloseparen(lookahead)) {
      // if we have a cons construction
      // match the next s-expression, close the list
      // and return
      if (isDotDelim(lookahead)) {
        match(isDotDelim)
        pointer.cdr = sexp()
        break
      }
      const next = sexp()
      const nextConsList = consProper(next)
      // attach the nextConsList to the current
      pointer.cdr = nextConsList
      // make pointer point to the next
      pointer = nextConsList
    }
    match(isCloseparen)
    return head
  }

  const num = () => {
    const val = match(isNum)
    return val.value
  }

  const str = () => {
    const val = match(isString)
    return val.value
  }

  const sym = () => {
    const val = match(isSymbol)
    return symExpr(val.value)
  }

  const qte = () => {
    match(isQuote)
    return quoteSexpr(sexp())
  }

  const match = <B extends Token>(
    p: Refinement<Token, B> & { matches?: Token['kind'] | '(' | ')' }
  ): B => {
    if (lookahead && p(lookahead)) {
      const old = lookahead
      reader.read()
      lookahead = reader.peek()[0]
      return old
    } else {
      throw expectingSyntaxError(
        p.matches ? p.matches : `token fulfilling predicate ${p.name || p}`,
        lookahead
      )
    }
  }

  const data = program()
  if (!reader.done) {
    throw expectingSyntaxError('s-expression', lookahead)
  }

  return data
}

const execute = (program: SExpression[], context: SymbolTable = symboltable) => {
  return program.map(evalFn(context))
}

export function interpreter(input: string, context?: SymbolTable, level?: 'eval'): any
export function interpreter(input: string, context?: SymbolTable, level?: 'tokens'): Token[]
export function interpreter(input: string, context?: SymbolTable, level?: 'ast'): SExpression[]
export function interpreter(input: string, context?: SymbolTable, level?: 'ast' | 'tokens' | 'eval'): Token[] | SExpression[]
export function interpreter(input: string, context?: SymbolTable, level: 'ast' | 'tokens' | 'eval' = 'eval') {
  const tokens = lexer(input)
  if (level === 'tokens') return tokens
  const ast = parser(tokens)
  if (level === 'ast') return ast
  const result = execute(ast, context)
  if (result.length === 1) return result[0]
  return result
}
