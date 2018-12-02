import { Refinement, Reader, arrayReadFun } from './util'
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
  ListDelimToken,
} from './lexer'
import mem from 'mem'
import { or, andT } from './match/functional'
import { Cons, listToIterable, consProper } from './Cons'

/* Execute With:

    npm run build
    node build/index.js

    OR

    npm run exec
*/

// type SymbolTable = {
//   [name: string]: SymbolTableEntry
// }

// type SymbolTableEntryBase = {
//   /** whether the symbol is a language builtin / cannot be redefined */
//   constant?: boolean
//   type: string
//   value: any
// }

// interface FunctionValue {
//   (table: SymbolTable, opts: { args: SExpression[] }): SExpression
//   kind: 'function'
//   lispname: string
// }

// const createFunctionValue = (
//   fn: (table: SymbolTable, opts: { args: SExpression[] }) => SExpression,
//   opts: string | { name: string, arglen?: number | [number, number] } = { name: 'lambda' }
// ): FunctionValue => {
//   const { name, arglen } = typeof opts === 'string' ? { name: opts } as Exclude<typeof opts, string> : opts
//   const min = typeof arglen === 'number' ? arglen : arglen && arglen[0]
//   const max = typeof arglen === 'number' ? arglen : arglen && arglen[1]
//   const newfn: typeof fn =
//     typeof arglen !== 'undefined' ? (table, opts) => {
//       if (opts.args.length < min!) {
//         throw new TypeError(`too few arguments given to ${name}`)
//       }
//       if (opts.args.length > max!) {
//         throw new TypeError(`too many arguments given to ${name}`)
//       }
//       return fn(table, opts)
//     } : fn

//   ; (newfn as FunctionValue).kind = 'function'
//   ; (newfn as FunctionValue).lispname = name
//   return newfn as FunctionValue
// }

// interface FunctionSymbolEntry extends SymbolTableEntryBase {
//   type: 'function'
//   value: FunctionValue
// }

// interface NilSymbolEntry extends SymbolTableEntryBase {
//   type: 'nil',
//   value: null
// }

// interface TrueSymbolEntry extends SymbolTableEntryBase {
//   type: 'true',
//   value: true
// }

// interface ListSymbolEntry extends SymbolTableEntryBase {
//   type: 'list',
//   value: Cons
// }

// interface StringSymbolEntry extends SymbolTableEntryBase {
//   type: 'string'
//   value: string
// }

// interface  NumberSymbolEntry extends SymbolTableEntryBase {
//   type: 'number'
//   value: number
// }

// interface SymbolSymbolEntry extends SymbolTableEntryBase {
//   type: 'symbol'
//   value: SymbolExpr
// }

// interface ConsSymbolEntry extends SymbolTableEntryBase {
//   type: 'cons'
//   value: Cons
// }

// type SymbolTableEntry =
//   | FunctionSymbolEntry
//   | NilSymbolEntry
//   | TrueSymbolEntry
//   | ListSymbolEntry
//   | StringSymbolEntry
//   | NumberSymbolEntry
//   | SymbolSymbolEntry 
//   | ConsSymbolEntry

// const getExprType = (table: SymbolTable, v: Expression): ValueTypeName => {
//   if (typeof v === 'string') return 'string'
//   if (typeof v === 'number') return 'number'
//   if (v === true) return 'true'
//   if (v === null) return 'nil'
//   if (v.kind === 'cons') return getExprType(table, force(table)(v))
//   // if (v.kind === 'list') return 'list'
//   if (v.kind === 'symbol') {
//     return getSymbol(table)(v.value).type
//   }
//   if (v.kind === 'function') return 'function'
//   return v
// }

// const expectedParamError = (v: Expression, expected: ValueTypeName) => new TypeError(`${printExpression(v)} is not a(n) ${expected}`)

// const forceAssert = <E extends ValueTypeName>(table: SymbolTable, expectedType: E, v: Expression): ValueTypeMap[E] => {
//   const type = getExprType(table, v)
//   const valid = expectedType === type
//   if (!valid) {
//     throw expectedParamError(v, expectedType)
//   }
//   return force(table)(v)
// }

// const allSymbolExpr = (l: SExpr): l is SymbolExpr[] & { kind: 'sexpr' } => {
//   l.forEach(v => {
//     if (!isSymbolExpr(v)) {
//       throw new TypeError(`Invalid lambda list element ${printExpression(v)}. A lambda list may only contain symbols`)
//     }
//   })
//   return true
// }

const REST_SYM = '&rest' 

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

// const symboltable = (): SymbolTable => ({
//   t: {
//     constant: true,
//     type: 'true',
//     value: true,
//   },
//   nil: {
//     constant: true,
//     type: 'nil',
//     value: null,
//   },
//   list: {
//     constant: true,
//     type: 'function',
//     value: createFunctionValue((table, { args }) => {
//       return args.length === 0 ? (getSymbol(table)('nil') as NilSymbolEntry).value : arrayLike('list', args)
//     }, { name: 'list' })
//   },
//   // head
//   car: {
//     constant: true,
//     type: 'function',
//     value: createFunctionValue((table, { args }) => {
//       const type = getExprType(table, args[0])
//       if (type !== 'list' && type !== 'nil') throw expectedParamError(args[0], 'list')
//       const list = force(table)(args[0])
//       const first = list === null ? null : (list as ExprList)[0]
//       return typeof first === 'undefined' ? null : first
//     }, { name: 'car', arglen: 1 })
//   },
//   // tail
//   cdr: {
//     constant: true,
//     type: 'function',
//     value: createFunctionValue((table, { args }) => {
//       const type = getExprType(table, args[0])
//       if (type !== 'list' && type !== 'nil') throw expectedParamError(args[0], 'list')
//       const list = force(table)(args[0])
//       const [,...rest] = list === null ? [] : (list as ExprList)
//       return rest.length === 0 ? null : arrayLike('list', rest)
//     }, { name: 'cdr', arglen: 1 })
//   },
//   cons: {
//     constant: true,
//     type: 'function',
//     value: createFunctionValue((table, { args }) => {
//       const car = args[0]
//       const cdr = args[1]
//       // cdr must either be list or nil
//       // if (cdr !== null) throw expectedParamError(cdr, 'list')
//       const type = getExprType(table, cdr)
//       if (type !== 'list' && type !== 'nil') throw expectedParamError(cdr, 'list')
//       // because we don't use singly-linked lists we have to evaluate the whole structure
//       const rest = force(table)(cdr)
//       return arrayLike('list', type === 'nil' ? [car] : [car, ...(rest as ExprList)])
//     }, { name: 'cons', arglen: 2 })
//   },
//   // defun: {
//   //   constant: true,
//   //   type: 'function',
//   //   value: createFunctionValue((table, { args }) => {
//   //     const [nameSym, arglist, body] =  args
//   //     if (!isSymbolExpr(nameSym)) {
//   //       throw new SyntaxError(`the name of a function must be a symbol, not ${printExpression(nameSym)}`)
//   //     }
//   //     const name = nameSym.value
//   //     if (!isSExpr(arglist)) {
//   //       throw new SyntaxError(`function ${name} is missing or has invalid lambda list`)
//   //     }
//   //     const lambdaList = validateLambdaList(arglist)
//   //     // const name = !isSymbolExpr(nameSym) ? 
//   //     // return 
//   //   }, { name: 'defun', arglen: 3 })
//   // },
//   print: {
//     constant: true,
//     type: 'function',
//     value: createFunctionValue((table, opts) => {
//       const arg = forceAssert(table, 'string', opts.args[0])
//       return arg
//     }, { name: 'print', arglen: 1 }),
//   },
//   '+': {
//     constant: true,
//     type: 'function',
//     value: createFunctionValue(
//       (table, opts) => opts.args.reduce((p: number, c) => p + forceAssert(table, 'number', c), 0),
//       '+'
//     )
//   },
//   '-': {
//     constant: true,
//     type: 'function',
//     value: createFunctionValue(
//       (table, opts) => opts.args.reduce((p: number, c) => p - forceAssert(table, 'number', c), 0),
//       '-'
//     )
//   },
//   '*': {
//     constant: true,
//     type: 'function',
//     value: createFunctionValue(
//       (table, opts) => opts.args.reduce((p: number, c) => p * forceAssert(table, 'number', c), 1),
//       '*'
//     )
//   },
//   '/': {
//     constant: true,
//     type: 'function',
//     value: createFunctionValue(
//       (table, opts) => opts.args.reduce((p: number, c) => p / forceAssert(table, 'number', c), 1),
//       '/'
//     )
//   },
// })

// const getSymbol = (table: SymbolTable) => (name: string) => {
//   const existing = table[name]
//   if (typeof existing === 'undefined')
//     throw new TypeError(`Symbol ${name} is not defined`)
//   return existing
// }

export interface Nil extends SymbolExpr { value: 'nil', [Symbol.toStringTag]: 'nil' }
export interface T extends SymbolExpr { value: 't', [Symbol.toStringTag]: 't' }
export const nil: Nil = { kind: 'symbol', value: 'nil', [Symbol.toStringTag]: 'nil' }
export const t: T = { kind: 'symbol', value: 't', [Symbol.toStringTag]: 't' }

export type SymbolExpr = { kind: 'symbol', value: string }
export type SExpression =  string | number | SymbolExpr | Cons

const isSymbolExpr = (e: SExpression): e is SymbolExpr =>
  typeof e === 'object' && e.kind === 'symbol'

export const isNil = andT(isSymbolExpr, (e): e is Nil => e.value === nil.value)
export const isT = andT(isSymbolExpr, (e): e is T => e.value === t.value)

export const printExpression = (val: SExpression): string => {
  if (typeof val === 'string') return `"${val}"`
  if (typeof val === 'number') return String(val)
  // TODO: handle special symbol names (like escaped chars)
  // clisp prints symbol names that required escaping surrounded by |
  // e.g. '\ a\ b\ c is printed as | a b c|
  if (isSymbolExpr(val)) return val.value
  if (val.kind === 'cons') {
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

// TODO: remove mutual recursion between force and callFunction
// const force = (table: SymbolTable) => (arg: Expression): Expression => {
//   if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') return arg
//   if (arg === null) return arg
//   if (arg.kind === 'list') return arrayLike('list', arg.map(force(table)))
//   if (arg.kind === 'sexpr') return callFunction(table, arg)
//   if (arg.kind === 'symbol') return getSymbol(table)(arg.value).value
//   return arg
// }

// const callFunction = mem((table: SymbolTable, fncall: SExpr) => {
//   const [fnSym, ...fnArgs] = fncall
//   if (!isSymbolExpr(fnSym)) {
//     throw new TypeError(`${printExpression(fnSym)} is not a function name; try using a symbol instead`)
//   }
//   const fnEntry = getSymbol(table)(fnSym.value)
//   if (fnEntry.type !== 'function') {
//     throw new TypeError(`undefined function ${fnSym.value}`)
//   }

//   return fnEntry.value(table, { args: fnArgs })
//   // since our variables are immutable, we don't have to worry
//   // about our symbol table changing
//   // therefore we can meomize only on fnArgs
// }, { cacheKey: (...args: any) => JSON.stringify(args[1]) })

const symExpr = mem((value: string): SymbolExpr => ({ kind: 'symbol', value }))

const isNum = (tok: Token): tok is NumToken => tok.kind === "number";
isNum.matches = 'number' as 'number'

const isString = (tok: Token): tok is StringToken => tok.kind === 'string'
isString.matches = 'string' as 'string'

const isSymbol = (tok: Token): tok is SymToken => tok.kind === 'symbol'
isSymbol.matches = 'symbol' as 'symbol'

const isDotDelim = (tok: Token): tok is ListDelimToken => tok.kind === 'dot'
isDotDelim.matches = 'dot' as 'dot'

const isAtom = (e: Token): e is StringToken | NumToken | SymToken =>
  e.kind === 'string'
  || e.kind === 'number'
  || e.kind === 'symbol'

const sExprEntrySet = or(isOpenparen, isAtom)

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
        break;
      }
    }
    return output
  }

  const sexp = (): SExpression => {
    if (lookahead) {
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
        break;
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

// const execute = (program: Expression[], context: SymbolTable = symboltable()) => {
//   return program.map(force(context))
// }

export function interpreter(input: string, context?: {}, level?: 'eval'): any
export function interpreter(input: string, context?: {}, level?: 'tokens'): Token[]
export function interpreter(input: string, context?: {}, level?: 'ast'): SExpression[]
export function interpreter(input: string, context?: {}, level?: 'ast' | 'tokens' | 'eval'): Token[] | SExpression[]
export function interpreter(input: string, context?: {}, level: 'ast' | 'tokens' | 'eval' = 'eval') {
  const tokens = lexer(input)
  if (level === 'tokens') return tokens
  const ast = parser(tokens)
  if (level === 'ast') return ast
  console.log(ast.map(printExpression).join('\n'))
  return ast
  // const result = execute(ast)
  // if (result.length === 1) return result[0]
  // return result
}

// console.log(parser(lexer("(+ 1 2) (- 3 4) (* 7 (+ 5 6))")));
// const firstinput = "(* 7 (+ 5 6))\n(+ 8 9)"; // > 77 \n 17
// const invalidinput = "(* 7 (+ % 6))";
// console.log(lexer(firstinput))
// console.log(lexer(invalidinput))
// Example final process:
// console.log(execute(parser(lexer(input))))
