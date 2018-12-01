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
} from './lexer'
import { TypeFromName, arrayOf } from './match/predicates'
import mem from 'mem';

/* Execute With:

    npm run build
    node build/index.js

    OR

    npm run exec
*/

type SymbolTable = {
  [name: string]: SymbolTableEntry
}

type SymbolTableEntryBase = {
  /** whether the symbol is a language builtin / cannot be redefined */
  constant?: boolean
  type: string
  value: any
}

interface FunctionValue {
  (table: SymbolTable, opts: { args: Expression[] }): Expression
  kind: 'function'
  lispname: string
}

const createFunctionValue = (
  fn: (table: SymbolTable, opts: { args: Expression[] }) => Expression,
  opts: string | { name: string, arglen?: number | [number, number] } = { name: 'lambda' }
): FunctionValue => {
  const { name, arglen } = typeof opts === 'string' ? { name: opts } as Exclude<typeof opts, string> : opts
  const min = typeof arglen === 'number' ? arglen : arglen && arglen[0]
  const max = typeof arglen === 'number' ? arglen : arglen && arglen[1]
  const newfn: typeof fn =
    typeof arglen !== 'undefined' ? (table, opts) => {
      if (opts.args.length < min!) {
        throw new TypeError(`too few arguments given to ${name}`)
      }
      if (opts.args.length > max!) {
        throw new TypeError(`too many arguments given to ${name}`)
      }
      return fn(table, opts)
    } : fn

  ; (newfn as FunctionValue).kind = 'function'
  ; (newfn as FunctionValue).lispname = name
  return newfn as FunctionValue
}

interface FunctionSymbolEntry extends SymbolTableEntryBase {
  type: 'function'
  value: FunctionValue
}

interface NilSymbolEntry extends SymbolTableEntryBase {
  type: 'nil',
  value: null
}

interface TrueSymbolEntry extends SymbolTableEntryBase {
  type: 'true',
  value: true
}

interface ListSymbolEntry extends SymbolTableEntryBase {
  type: 'list',
  value: ExprList
}

interface StringSymbolEntry extends SymbolTableEntryBase {
  type: 'string'
  value: string
}

interface  NumberSymbolEntry extends SymbolTableEntryBase {
  type: 'number'
  value: number
}

interface SymbolSymbolEntry extends SymbolTableEntryBase {
  type: 'symbol'
  value: SymbolExpr
}

interface SExprSymbolEntry extends SymbolTableEntryBase {
  type: 'sexpr'
  value: SExpr
}

type SymbolTableEntry =
  | FunctionSymbolEntry
  | NilSymbolEntry
  | TrueSymbolEntry
  | ListSymbolEntry
  | StringSymbolEntry
  | NumberSymbolEntry
  | SymbolSymbolEntry 
  | SExprSymbolEntry
type ValueTypeName = SymbolTableEntry['type']
type ValueType = SymbolTableEntry['value']

type ValueTypeMap = {
  'function': FunctionValue
  'number': number
  'true': true
  'nil': null
  'list': ExprList
  'string': string
  'symbol': SymbolExpr
  'sexpr': SExpr
}

const getExprType = (table: SymbolTable, v: Expression): ValueTypeName => {
  if (typeof v === 'string') return 'string'
  if (typeof v === 'number') return 'number'
  if (v === true) return 'true'
  if (v === null) return 'nil'
  if (v.kind === 'sexpr') return getExprType(table, force(table)(v))
  if (v.kind === 'list') return 'list'
  if (v.kind === 'symbol') {
    return getSymbol(table)(v.value).type
  }
  if (v.kind === 'function') return 'function'
  return v
}

const expectedParamError = (v: Expression, expected: ValueTypeName) => new TypeError(`${printExpression(v)} is not a(n) ${expected}`)

const forceAssert = <E extends ValueTypeName>(table: SymbolTable, expectedType: E, v: Expression): ValueTypeMap[E] => {
  const type = getExprType(table, v)
  const valid = expectedType === type
  if (!valid) {
    throw expectedParamError(v, expectedType)
  }
  return force(table)(v)
}

const allSymbolExpr = (l: SExpr): l is SymbolExpr[] & { kind: 'sexpr' } => {
  l.forEach(v => {
    if (!isSymbolExpr(v)) {
      throw new TypeError(`Invalid lambda list element ${printExpression(v)}. A lambda list may only contain symbols`)
    }
  })
  return true
}

const REST_SYM = '&rest' 

const validateLambdaList = (l: SExpr) => {
  if (allSymbolExpr(l)) {
    let hitRest = false
    let nextIsRest = false
    const output = [] as Array<{ name: string, rest?: boolean }>
    for (const sym of l) {
      // if we already had a rest parameter and the next one is not the parameter name
      // i.e. we tried to provide a param after a rest param: (defun test (a &rest b c) c)
      if (!nextIsRest && hitRest) {
        throw new SyntaxError(`lambda list element ${sym.value} is superfluous. Only one variable is allowed after ${REST_SYM}`)
      }
      if (sym.value === REST_SYM) {
        // if we provide multiple rest paramters: (defun test (a &rest b &rest c) c)
        if (hitRest) {
          throw new SyntaxError(`lambda list marker ${REST_SYM} not allowed here`)
        }
        nextIsRest = true
        hitRest = true
        continue
      }
      if (nextIsRest) {
        output.push({ name: sym.value, rest: true })
        nextIsRest = false
        continue
      }
      output.push({ name: sym.value })
    }
    // we had a rest parameter, but the name was not provided. i.e. (defun test (a &rest) a)
    if (nextIsRest) {
      throw new SyntaxError(`missing ${REST_SYM} parameter in lambda list`)
    }
    return output
  }
  return []
}

const symboltable = (): SymbolTable => ({
  t: {
    constant: true,
    type: 'true',
    value: true,
  },
  nil: {
    constant: true,
    type: 'nil',
    value: null,
  },
  list: {
    constant: true,
    type: 'function',
    value: createFunctionValue((table, { args }) => {
      return args.length === 0 ? (getSymbol(table)('nil') as NilSymbolEntry).value : arrayLike('list', args)
    }, { name: 'list' })
  },
  // head
  car: {
    constant: true,
    type: 'function',
    value: createFunctionValue((table, { args }) => {
      const type = getExprType(table, args[0])
      if (type !== 'list' && type !== 'nil') throw expectedParamError(args[0], 'list')
      const list = force(table)(args[0])
      const first = list === null ? null : (list as ExprList)[0]
      return typeof first === 'undefined' ? null : first
    }, { name: 'car', arglen: 1 })
  },
  // tail
  cdr: {
    constant: true,
    type: 'function',
    value: createFunctionValue((table, { args }) => {
      const type = getExprType(table, args[0])
      if (type !== 'list' && type !== 'nil') throw expectedParamError(args[0], 'list')
      const list = force(table)(args[0])
      const [,...rest] = list === null ? [] : (list as ExprList)
      return rest.length === 0 ? null : arrayLike('list', rest)
    }, { name: 'cdr', arglen: 1 })
  },
  cons: {
    constant: true,
    type: 'function',
    value: createFunctionValue((table, { args }) => {
      const car = args[0]
      const cdr = args[1]
      // cdr must either be list or nil
      // if (cdr !== null) throw expectedParamError(cdr, 'list')
      const type = getExprType(table, cdr)
      if (type !== 'list' && type !== 'nil') throw expectedParamError(cdr, 'list')
      // because we don't use singly-linked lists we have to evaluate the whole structure
      const rest = force(table)(cdr)
      return arrayLike('list', type === 'nil' ? [car] : [car, ...(rest as ExprList)])
    }, { name: 'cons', arglen: 2 })
  },
  // defun: {
  //   constant: true,
  //   type: 'function',
  //   value: createFunctionValue((table, { args }) => {
  //     const [nameSym, arglist, body] =  args
  //     if (!isSymbolExpr(nameSym)) {
  //       throw new SyntaxError(`the name of a function must be a symbol, not ${printExpression(nameSym)}`)
  //     }
  //     const name = nameSym.value
  //     if (!isSExpr(arglist)) {
  //       throw new SyntaxError(`function ${name} is missing or has invalid lambda list`)
  //     }
  //     const lambdaList = validateLambdaList(arglist)
  //     // const name = !isSymbolExpr(nameSym) ? 
  //     // return 
  //   }, { name: 'defun', arglen: 3 })
  // },
  print: {
    constant: true,
    type: 'function',
    value: createFunctionValue((table, opts) => {
      const arg = forceAssert(table, 'string', opts.args[0])
      return arg
    }, { name: 'print', arglen: 1 }),
  },
  '+': {
    constant: true,
    type: 'function',
    value: createFunctionValue(
      (table, opts) => opts.args.reduce((p: number, c) => p + forceAssert(table, 'number', c), 0),
      '+'
    )
  },
  '-': {
    constant: true,
    type: 'function',
    value: createFunctionValue(
      (table, opts) => opts.args.reduce((p: number, c) => p - forceAssert(table, 'number', c), 0),
      '-'
    )
  },
  '*': {
    constant: true,
    type: 'function',
    value: createFunctionValue(
      (table, opts) => opts.args.reduce((p: number, c) => p * forceAssert(table, 'number', c), 1),
      '*'
    )
  },
  '/': {
    constant: true,
    type: 'function',
    value: createFunctionValue(
      (table, opts) => opts.args.reduce((p: number, c) => p / forceAssert(table, 'number', c), 1),
      '/'
    )
  },
})

const getSymbol = (table: SymbolTable) => (name: string) => {
  const existing = table[name]
  if (typeof existing === 'undefined')
    throw new TypeError(`Symbol ${name} is not defined`)
  return existing
}

type SymbolExpr = { kind: 'symbol', value: string }
type UnevaluatedExpression = SymbolExpr | SExpr
type Expression = ValueType | UnevaluatedExpression | ExprList
interface ExprList extends Array<Expression> {
  kind: 'list'
}
interface SExpr extends Array<Expression> {
  kind: 'sexpr'
}

function arrayLike(kind: 'list', list?: Expression[]): ExprList
function arrayLike(kind: 'sexpr', list?: Expression[]): SExpr
function arrayLike(kind: 'sexpr' | 'list', list: Expression[] = []): any[] {
  (list as SExpr | ExprList).kind = kind
  return list
}

const isSymbolExpr = (e: Expression): e is SymbolExpr =>
  typeof e === 'object'
  && e !== null
  && !Array.isArray(e)
  && e.kind === 'symbol'

const isSExpr = (e: Expression): e is SExpr =>
  Array.isArray(e)
  && e.kind === 'sexpr'

const isFunctionVal = (e: Expression): e is FunctionValue =>
  typeof e === 'function'
  && e.kind === 'function'

export const printExpression = (val: Expression): string => {
  if (typeof val === 'string') return `"${val}"`
  if (typeof val === 'number') return String(val)
  if (val === null) return 'nil'
  if (val === true) return 't'
  // TODO: change once we have lambdas
  if (isFunctionVal(val)) return `(defun ${val.lispname} [native code] )`
  if (isSymbolExpr(val)) return val.value
  if (val.kind === 'list') return `(list ${val.map(printExpression).join(' ')})`
  if (val.kind === 'sexpr') return `(${val.map(printExpression).join(' ')})`
  return val
}

const isParen = (tok: Token): tok is ParenToken => tok.kind === 'paren'

const isOpenparen = (tok: Token): tok is OpenParen =>
  isParen(tok) && tok.value === 'open'

const isCloseparen = (tok: Token): tok is CloseParen =>
  isParen(tok) && tok.value === 'close'

// TODO: remove mutual recursion between force and callFunction
const force = (table: SymbolTable) => (arg: Expression): Expression => {
  if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') return arg
  if (arg === null) return arg
  if (arg.kind === 'list') return arrayLike('list', arg.map(force(table)))
  if (arg.kind === 'sexpr') return callFunction(table, arg)
  if (arg.kind === 'symbol') return getSymbol(table)(arg.value).value
  return arg
}

const callFunction = mem((table: SymbolTable, fncall: SExpr) => {
  const [fnSym, ...fnArgs] = fncall
  if (!isSymbolExpr(fnSym)) {
    throw new TypeError(`${printExpression(fnSym)} is not a function name; try using a symbol instead`)
  }
  const fnEntry = getSymbol(table)(fnSym.value)
  if (fnEntry.type !== 'function') {
    throw new TypeError(`undefined function ${fnSym.value}`)
  }

  return fnEntry.value(table, { args: fnArgs })
  // since our variables are immutable, we don't have to worry
  // about our symbol table changing
  // therefore we can meomize only on fnArgs
}, { cacheKey: (...args: any) => JSON.stringify(args[1]) })

const symExpr = mem((value: string) => ({ kind: 'symbol' as 'symbol', value }))

const readTokens = (toks: Token[]): Expression => {
  if (toks.length === 0) throw new SyntaxError('Unexpected EOF')
  let tok = toks.shift()
  if (!tok) throw new SyntaxError('Unexpected EOF')
  if (isOpenparen(tok)) {
    const arr: SExpr = arrayLike('sexpr')
    while (toks[0] && !isCloseparen(toks[0])) {
      arr.push(readTokens(toks))
    }
    if (!toks[0]) throw new SyntaxError('Unexpected EOF')
    toks.shift() // remove the closing paren ')'
    if (arr.length === 0) return symExpr('nil')
    return arr
  } else if (isCloseparen(tok)) {
    throw new SyntaxError('Unexpected )')
  } else if (tok.kind !== 'symbol') {
    return tok.value
  } else {
    return symExpr(tok.value)
  }
}

const parser = (toks: Token[]) => {
  const program: Expression[] = []
  while (toks.length > 0) {
    program.push(readTokens(toks))
  }
  return program
}

const execute = (program: Expression[], context: SymbolTable = symboltable()) => {
  return program.map(force(context))
}

export const interpreter = (
  input: string,
  context?: {},
  level: 'ast' | 'tokens' | 'eval' = 'eval',
) => {
  const tokens = lexer(input)
  if (level === 'tokens') return tokens
  const ast = parser(tokens)
  if (level === 'ast') return ast
  const result = execute(ast)
  if (result.length === 1) return result[0]
  return result
}

// console.log(parser(lexer("(+ 1 2) (- 3 4) (* 7 (+ 5 6))")));
// const firstinput = "(* 7 (+ 5 6))\n(+ 8 9)"; // > 77 \n 17
// const invalidinput = "(* 7 (+ % 6))";
// console.log(lexer(firstinput))
// console.log(lexer(invalidinput))
// Example final process:
// console.log(execute(parser(lexer(input))))
