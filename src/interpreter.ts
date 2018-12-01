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

/* Execute With:

    npm run build
    node build/index.js

    OR

    npm run exec
*/

type ValueType =
  | number
  | true
  | null
  | ((table: SymbolTable, opts: { args: any }) => any)
  | ValueTypeList
  | string

interface ValueTypeList extends Array<ValueType> {}
type ValueTypeName = 'function' | 'number' | 'true' | 'nil' | 'list' | 'string'

type GetValueType<Expected extends ValueTypeName> = 
  Expected extends 'function' ? (...args: any[]) => any
  : Expected extends 'number' ? number
  : Expected extends 'true' ? true
  : Expected extends 'nil' ? null
  : Expected extends 'list' ? ValueTypeList
  : Expected extends 'string' ? string
  : never

type GetValueTypeName<V extends ValueType> =
  V extends number ? 'number'
  : V extends (...args: any[]) => any ? 'function'
  : V extends string ? 'string'
  : V extends ValueTypeList ? 'list'
  : V extends true ? 'true'
  : V extends null ? 'nil'
  : never

type SymbolTable = {
  [name: string]: {
    /** whether the symbol is a language builtin / cannot be redefined */
    constant?: boolean
    value: ValueType
  }
}

type SymbolTableEntry = SymbolTable[string]

const assertType = <E extends ValueTypeName>(expectedType: E) => (
  v: any,
): v is GetValueType<E> => {
  let valid = true
  if (typeof expectedType === 'string' && expectedType !== 'list') {
    valid = typeof v === expectedType
  } else if (expectedType === 'list') {
    valid = Array.isArray(v)
  } else {
    valid = v === expectedType
  }
  if (!valid) {
    throw new TypeError(`${printExpression(v)} is not a(n) ${expectedType}`)
  }
  return valid
}

const assertAll = <E extends ValueTypeName>(expectedType: E) =>
  arrayOf(assertType(expectedType))

const assertInput = <Fn extends (table: SymbolTable, opts: { args: any }) => any>(
  fn: Fn,
  assertOpts: { type: GetValueTypeName<Parameters<Fn>[1]['args'][number]>, length?: number },
): Fn => {
  return ((table, opts) => {
    assertAll(assertOpts.type as any)(opts.args)
    if (assertOpts.length && opts.args.length !== assertOpts.length) {
      if (opts.args.length < assertOpts.length) {
        throw new TypeError('too few arguments given')
      } else {
        throw new TypeError('too many arguments given')
      }
    }
    return fn(table, opts)
  }) as Fn
}

const symboltable = (): SymbolTable => ({
  t: {
    constant: true,
    value: true,
  },
  nil: {
    constant: true,
    value: null,
  },
  list: {
    constant: true,
    value: (table: SymbolTable, { args }: { args: ValueTypeList }) => args.length === 0 ? getSymbol('nil')(table) : args,
  },
  'def!': {
    constant: true,
    value: () => {},
  },
  'defconst!': {
    constant: true,
    value: () => {},
  },
  print: {
    constant: true,
    value: assertInput((_table: SymbolTable, opts: { args: [string] }) => { console.log(opts.args[0]); return opts.args[0] }, { type: 'string', length: 1 })
  },
  '+': {
    constant: true,
    value: assertInput((_table: SymbolTable, opts: { args: number[] }) => opts.args.reduce((p, c) => p + c, 0), {
      type: 'number',
    }),
  },
  '-': {
    constant: true,
    value: assertInput((_table: SymbolTable, opts: { args: number[] }) => opts.args.reduce((p, c) => p - c, 0), {
      type: 'number',
    }),
  },
  '*': {
    constant: true,
    value: assertInput((_table: SymbolTable, opts: { args: number[] }) => opts.args.reduce((p, c) => p * c, 1), {
      type: 'number',
    }),
  },
  '/': {
    constant: true,
    value: assertInput((_table: SymbolTable, opts: { args: number[] }) => opts.args.reduce((p, c) => p / c, 1), {
      type: 'number',
    }),
  },
})

const getSymbol = (name: string) => (table: SymbolTable) => {
  const existing = table[name]
  if (typeof existing === 'undefined')
    throw new TypeError(`Symbol ${name} is not defined`)
  return existing
}

const addSymbol = (
  name: string,
  value: SymbolTableEntry['value'],
  constant = false,
) => (table: SymbolTable) => {
  const existing = table[name]
  if (existing && existing.constant) {
    throw new TypeError(`Cannot redeclare symbol ${name}`)
  }
  table[name] = { constant, value }
  return table
}

type Expression = StringToken | NumToken | SymToken | ExprList
interface ExprList extends Array<Expression> {} 

const printExpression = (expr: Expression): string => {
  // TODO: eliminate recursion here
  if (Array.isArray(expr)) return `(list ${expr.map(printExpression).join(' ')})`
  if (expr.kind === 'number') return expr.origvalue
  if (expr.kind === 'symbol') return expr.origvalue
  if (expr.kind === 'string') return expr.origvalue
  return expr
}

const isParen = (tok: Token): tok is ParenToken => tok.kind === 'paren'

const isOpenparen = (tok: Token): tok is OpenParen =>
  isParen(tok) && tok.value === 'open'

const isCloseparen = (tok: Token): tok is CloseParen =>
  isParen(tok) && tok.value === 'close'

// TODO: remove mutual recursion between force and callFunction
const force = (table: SymbolTable) => (arg: Expression): any => {
  if (Array.isArray(arg)) return arg.length === 0 ? getSymbol('nil')(table).value : callFunction(table, ...arg)
  if (arg.kind === 'symbol') return getSymbol(arg.value)(table).value
  return arg.value
}

const callFunction = (table: SymbolTable, ...fncall: ExprList) => {
  const [fnSym, ...fnArgs] = fncall
  const fnEntry = !Array.isArray(fnSym) && fnSym.kind === 'symbol' ? getSymbol(fnSym.value)(table) : false
  if (!fnEntry || typeof fnEntry.value !== 'function') {
    throw new TypeError(`${printExpression(fnSym)} is not a function name; try using a symbol instead`)
  }
  return fnEntry.value(table, { args: fnArgs.map(force(table)) })
}

const readTokens = (toks: Token[]): Expression => {
  if (toks.length === 0) throw new SyntaxError('Unexpected EOF')
  let tok = toks.shift()
  if (!tok) throw new SyntaxError('Unexpected EOF')
  if (isOpenparen(tok)) {
    const arr: ExprList = []
    while (toks[0] && !isCloseparen(toks[0])) {
      arr.push(readTokens(toks))
    }
    if (!toks[0]) throw new SyntaxError('Unexpected EOF')
    toks.shift() // remove the closing paren ')'
    return arr
  } else if (isCloseparen(tok)) {
    throw new SyntaxError('Unexpected )')
  } else {
    return tok
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
