import preludeFile from '!raw-loader!./prelude.tlsp'
import { printExpression } from '../print'
import { evalFn, macroExpand, macroExpand1, } from '../eval'
import { add, div, sub, mult, gt, lt, lte, gte, eq, tuple, compose } from '../util'
import { reduce as reduceI } from '../iterable'
import { Predicate } from '../match/types'
import { readString } from '../parser'
import { typeOf } from '../match/predicates'
import {
  SExpression, ConsG, EmptyList,
  Cons, LambdaFn, SymbolTable,
} from '../runtime'
import * as R from '../runtime'
import { t, f, T, F } from '../runtime/common-symbols'
import vm from 'vm'


export const vmContext = vm.createContext({
  tslisp: Object.freeze({ ...R, })
})

function* iterateTables(table: SymbolTable) {
  let tablePointer: SymbolTable['parent'] = table
  while (tablePointer !== null) {
    yield tablePointer.table
    tablePointer = tablePointer.parent
  }
}

export function getSymbol(env: SymbolTable, name: symbol, crash?: true): SExpression
export function getSymbol(env: SymbolTable, name: symbol, crash: false): SExpression | undefined
export function getSymbol(env: SymbolTable, name: symbol, crash: boolean): SExpression | undefined
export function getSymbol(env: SymbolTable, name: symbol, crash = true): SExpression | undefined {
  for (const table of iterateTables(env)) {
    const existing = table.get(name)
    if (typeof existing !== 'undefined')
      return existing
  }
  if (crash)
    throw new ReferenceError(`Symbol ${printExpression(name)} has no value`)
  return undefined
}

export const pushTable = (table: SymbolTable): SymbolTable => {
  return { parent: table, table: new Map() }
}

export const setValue = (env: SymbolTable, name: symbol, value: SExpression) => {
  if (env.table.has(name)) {
    throw new ReferenceError(`cannot rebind symbol ${printExpression(name)}`)
  }

  env.table.set(name, value)

  return name
}

type CPair1<
  T1 extends SExpression = SExpression,
> = ConsG<T1, SExpression>
type CPair2<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
> = ConsG<T1, CPair1<T2>>
type CPair3<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
> = ConsG<T1, CPair2<T2, T3>>
type CPair4<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
  T4 extends SExpression = SExpression,
> = ConsG<T1, CPair3<T2, T3, T4>>
type CPair5<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
  T4 extends SExpression = SExpression,
  T5 extends SExpression = SExpression,
> = ConsG<T1, CPair4<T2, T3, T4, T5>>

type CTuple1<T extends SExpression = SExpression> = ConsG<T, EmptyList>
type CTuple2<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
> = ConsG<T1, CTuple1<T2>>
type CTuple3<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
> = ConsG<T1, CTuple2<T2, T3>>
type CTuple4<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
  T4 extends SExpression = SExpression,
> = ConsG<T1, CTuple3<T2, T3, T4>>
type CTuple5<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
  T4 extends SExpression = SExpression,
  T5 extends SExpression = SExpression,
> = ConsG<T1, CTuple4<T2, T3, T4, T5>>

export function validate(fncall: Cons, arglen: [5, number], proper?: boolean): CPair5
export function validate(fncall: Cons, arglen: [4, number], proper?: boolean): CPair4
export function validate(fncall: Cons, arglen: [3, number], proper?: boolean): CPair3
export function validate(fncall: Cons, arglen: [2, number], proper?: boolean): CPair2
export function validate(fncall: Cons, arglen: [1, number], proper?: boolean): CPair1
export function validate(fncall: Cons, arglen: 5, proper?: true): CTuple5
export function validate(fncall: Cons, arglen: 4, proper?: true): CTuple4
export function validate(fncall: Cons, arglen: 3, proper?: true): CTuple3
export function validate(fncall: Cons, arglen: 2, proper?: true): CTuple2
export function validate(fncall: Cons, arglen: 1, proper?: true): CTuple1
export function validate(fncall: Cons, arglen: number | [number, number], proper?: true): Cons
export function validate(fncall: Cons, arglen: number | [number, number], proper?: boolean): SExpression
export function validate(fncall: Cons, arglen: number | [number, number], proper = true): SExpression {
  const { car: fnNameSym, cdr: args } = fncall
  const [min] = typeof arglen === 'number' ? [arglen, arglen] : arglen

  if (typeof fnNameSym !== 'symbol' && !R.isLambdaFn(fnNameSym) && !R.isBoostrapFn(fnNameSym))
    throw new Error(`Don't know how we got here, but function call name ${fnNameSym} is not a symbol or function`)
  const name = (fnNameSym as symbol).description || (fnNameSym as LambdaFn).name || '[lambda]'
  if (proper && !R.isProperList(args))
    throw new TypeError(`argument list given to ${name} is dotted: ${printExpression(fncall)}`)
  if (!R.isCons(args)) {
    if (!Array.isArray(arglen)) return args
    throw new TypeError(`argument list given to ${name} is dotted: ${printExpression(fncall)}`)
  }

  // TODO: this can loop infinitely if args has a cycle
  const len = R.ConsLib.unsafeLength(args)
  if (len < min) {
    throw new TypeError(`too few arguments given to ${name}: ${printExpression(fncall)}`)
  }

  return args
}

// const accumulate1 = <T extends SExpression>(op: Fn<[T, T], T>, identity: T, pred: (v: SExpression) => v is T) =>
//   (fncall: Cons, _: SymbolTable, n: [number, number]): SExpression => {
//     const { car: first, cdr: rest } = validate(fncall, n as [1, number], false)
//     if (!pred(first))
//       throw new TypeError(`accumulate1: ${printExpression(first)} is not the correct type`)
//     if (!isCons(rest)) return op(identity, first)
//     return reduce1Cons(op, pred)(cons(first, rest))
//   }

// const compare = (op: Fn<[number, number], boolean>) =>
//   (fncall: Cons, _: SymbolTable, n: [number, number]): SExpression => {
//     const args = validate(fncall, n, false)

//     const argsArr = [...listToIterable(args, false)]
//     for (let i = 1; i < argsArr.length; i++) {
//       const first = argsArr[i - 1]
//       const second = argsArr[i]
//       if (typeof first !== 'number')
//         throw new TypeError(`${printExpression(first)} is not a number`)
//       if (typeof second !== 'number')
//         throw new TypeError(`${printExpression(second)} is not a number`)

//       if (op(first, second)) continue
//       else return f
//     }
//     return t
//   }

const createSExprEntry =
  <T extends string>(symbol: symbol | T, value: SExpression): [symbol, SExpression] =>
    [typeof symbol === 'string' ? R.Symbols.symExpr(symbol) : symbol, value]

function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: 5 | [5, number],
  body: (args: CPair5, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: true,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: 4 | [4, number],
  body: (args: CPair4, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: true,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: 3 | [3, number],
  body: (args: CPair3, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: true,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: 2 | [2, number],
  body: (args: CPair2, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: true,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: 1 | [1, number],
  body: (args: CPair1, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: true,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: number | [number, number],
  body: (args: Cons, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry: boolean,
  doValidate: false,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: number | [number, number],
  body: (args: SExpression, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: boolean,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: Parameters<typeof R.createBoostrap>[2],
  body: (args: any, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate = true,
): ReturnType<typeof createSExprEntry> {
  const name = typeof symbol === 'string' ? symbol : symbol.description
  const realBody
    = !doValidate
    ? body
    : (fncall: Cons, env: SymbolTable, numParams: [number, number]) =>
      body(validate(fncall, numParams), env, numParams)
  return createSExprEntry(symbol, R.createBoostrap(
    realBody, name, numParams, curry
  ))
}

const createPred = <T extends string>(name: T | symbol, pred: Predicate<SExpression>) =>
  createBoostrapEntry(name, 1, args => {
    const { car } = args as Cons
    return pred(car) ? t : f
  })

const createBinaryOp = <N extends string, T extends SExpression>(name: N | symbol, binary: (a: T, b: T) => SExpression, pred: (v: SExpression) => v is T) =>
  createBoostrapEntry(name, 2, args => {
    const { car: n1, cdr: { car: n2 }} = args
    if (!pred(n1) || !pred(n2))
      throw new Error(`${typeof name === 'string' ? name : name.description}: expected number`)
    return binary(n1, n2)
  }, true)

let gensymCounter = 0

const equal = (
  args: ConsG<SExpression, ConsG<SExpression, SExpression>>,
): T | F => {
  // Object reference equality
  const { car: o1, cdr: { car: o2 } } = args
  return o1 === o2 ? t : f
}

const symboltableTable: SymbolTable['table'] = new Map<symbol, SExpression>([
  createSExprEntry(t, t),
  createSExprEntry(f, f),
  createSExprEntry('Infinity', Infinity),
  // since we don't have infinity as a special case when parsing numbers,
  // we cannot use standard unary negation
  createSExprEntry('-Infinity', -Infinity),
  createBoostrapEntry('eval', 1, args => {
    const { car: arg } = args as Cons
    return evalFn(symboltable, arg)
  }),
  createBoostrapEntry('typeof', 1, ({ car }) => R.Util.sexprTypeOf(car)),
  createBoostrapEntry('native-eval', 1, args => {
    const { car: str } = args
    if (typeof str !== 'string')
      throw new Error('native-eval: expected string')

    const evaluated: unknown = vm.runInContext(str, vmContext)

    const val = R.Util.marshallValue(evaluated)
    if (val === null)
      throw Error('native-eval: returned invalid value')

    return val
  }),
  createBinaryOp('add', add, typeOf('number')),
  createBinaryOp('sub', sub, typeOf('number')),
  createBinaryOp('mult', mult, typeOf('number')),
  createBinaryOp('div', div, typeOf('number')),
  createBinaryOp('gt', compose(R.Util.boolToLisp, gt), typeOf('number')),
  createBinaryOp('lt', compose(R.Util.boolToLisp, lt), typeOf('number')),
  createBinaryOp('lte', compose(R.Util.boolToLisp, lte), typeOf('number')),
  createBinaryOp('gte', compose(R.Util.boolToLisp, gte), typeOf('number')),
  createBinaryOp('num=', compose(R.Util.boolToLisp, eq), typeOf('number')),
  createBinaryOp('str-concat', (a: string, b: string) => a + b, typeOf('string')),
  createBoostrapEntry('print', 1, args => {
    const { car: arg } = args
    console.log(printExpression(arg))
    return arg
  }),
  createBoostrapEntry('str', 1, ({ car }) => printExpression(car)),
  createBoostrapEntry('car', 1, ({ car: arg }) => R.ConsLib.car(arg)),
  createBoostrapEntry('cdr', 1, ({ car: arg }) => R.ConsLib.cdr(arg)),
  createBoostrapEntry('list*', [2, Infinity], args => {
    if (!R.isCons(args))
      throw new TypeError(`list*: Expecting cons, but recieved ${printExpression(args)}`)
    return R.ConsLib.fromArray([...R.ConsLib.listToIterable(args, false)], { notProper: true })
  }),
  createBoostrapEntry('append', [0, Infinity], args => {
    return R.ConsLib.append(R.ConsLib.listToIterable(args, false))
  }),
  createBoostrapEntry('eq?', 2, equal, true),
  createPred('list?', R.isProperList),
  createPred('integer?', v => typeof v === 'number' && Number.isInteger(v)),
  createPred('natural?', v => typeof v === 'number' && Number.isInteger(v) && v >= 0),
  createPred('lambda?', R.isLambdaFn),
  createPred('macro?', R.isMacro),
  createPred('symbol-interned?', v => {
    if (typeof v !== 'symbol')
      throw new TypeError(`Expected symbol?, given ${printExpression(v)}`)
    return R.isInterned(v)
  }),
  createPred('nan?', v => {
    if (typeof v !== 'number')
      throw new TypeError(`Expected number?, given ${printExpression(v)}`)
    return Number.isNaN(v)
  }),
  createPred('infinite?', v => {
    if (typeof v !== 'number')
      throw new TypeError(`Expected number?, given ${printExpression(v)}`)
    return !Number.isFinite(v)
  }),
  createBoostrapEntry('exit', [0, 1], args => {
    const { car: num } = R.isCons(args) ? args : { car: 0 }
    if (typeof num !== 'number')
      throw new Error('exit: expected number')
    process.exit(num)
    return num
  }),
  createBoostrapEntry('number->string', [1, 2], args => {
    const { car: num, cdr } = args
    if (cdr !== R.empty && !R.isCons(cdr))
      throw new TypeError(`number->string: Expected the options to be a hash-map`)

    if (typeof num !== 'number')
      throw new TypeError(`number->string: Expected number, but recieved ${printExpression(num)}`)

    // TODO: replace with a proper hash-map implementation
    const optionsIter = cdr === R.empty ? [] : R.ConsLib.listToIterable(R.ConsLib.car(cdr as Cons), false)
    console.log(cdr)
    type Options = { mode: 'radix' | 'fixed' | 'prec' | 'exp', param: number }
    const symbols = tuple(R.Symbols.symExpr('radix'), R.Symbols.symExpr('fixed'), R.Symbols.symExpr('prec'), R.Symbols.symExpr('exp'))

    const { mode, param } = reduceI(optionsIter, (acc, curr) => {
      console.log('Acc', acc, 'Curr', curr)
      if (!R.isCons(curr))
        throw new TypeError(`number->string: Expected the options to be a hash-map`)
      const { car: key, cdr: value } = curr
      if (typeof key !== 'symbol' || !(symbols as symbol[]).includes(key))
        return acc
      if (typeof value !== 'number')
        throw new TypeError(`number->string: value for option ${printExpression(key)} must be a number`)
      const mode: Options['mode'] = (key as (typeof symbols)[number]).description
      if (mode === 'radix' && (value < 2 || value > 36))
        throw new RangeError(`number->string: radix argument must be between 2 and 36`)
      else if (mode === 'prec' && (value < 1 || value > 100))
        throw new RangeError(`number->string: prec argument must be between 1 and 100`)
      else if ((mode === 'fixed' || mode === 'exp') && (value < 0 || value > 100))
        throw new RangeError(`number->string: ${mode} argument must be between 0 and 100`)

      acc.mode = mode
      acc.param = value
      return acc
    }, { mode: 'radix', param: 10 } as Options)

    return mode === 'radix'
      ? num.toString(param)
      : mode === 'exp' ? num.toExponential(param)
      : mode === 'fixed' ? num.toFixed(param)
      : mode === 'prec' ? num.toPrecision(param)
      : mode
  }),
  createBoostrapEntry('string->symbol', 1, args => {
    const { car: arg } = args
    if (typeof arg !== 'string')
      throw new TypeError(`${printExpression(arg)} is not a string`)
    return R.Symbols.symExpr(arg)
  }),
  createBoostrapEntry('string->uninterned-symbol', 1, args => {
    const { car: arg } = args
    if (typeof arg !== 'string')
      throw new TypeError(`${printExpression(arg)} is not a string`)
    return Symbol(arg)
  }),
  createBoostrapEntry('read/string', 1, args => {
    const { car: arg } = args
    if (typeof arg !== 'string')
      throw new TypeError(`Expected string?, given ${printExpression(arg)}`)
    const arr = readString(arg)
    return arr.length === 1 ? arr[0] : R.ConsLib.fromArray(arr)
  }),
  createBoostrapEntry('macroexpand', 1, (args, env) => {
    const { car: arg } = args
    return macroExpand(arg, env)
  }),
  createBoostrapEntry('macroexpand-1', 1, (args, env) => {
    const { car: arg } = args
    return macroExpand1(arg, env)
  }),
  createBoostrapEntry('procedure-arity', 1, args => {
    const { car: fn } = args
    if (!R.isProcedure(fn))
      throw new Error('procedure-arity: expected function')
    return R.ConsLib.fromArray(R.Util.arity(fn))
  }),
  createBoostrapEntry('procedure-orig-arity', 1, args => {
    const { car: fn } = args
    if (!R.isProcedure(fn))
      throw new Error('procedure-orig-arity: expected function')
    return R.ConsLib.fromArray(fn.numParams)
  }),
  createBoostrapEntry('procedure-name', 1, args => {
    const { car: fn } = args
    if (!R.isProcedure(fn))
      throw new Error('procedure-name: expected function')
    return fn.name || ''
  }),
  createBoostrapEntry('rename-procedure', 2, args => {
    const { car: name, cdr: { car: fn } } = args

    if (typeof name !== 'string')
      throw new Error('rename-procedure: expected string')
    if (!R.isProcedure(fn))
      throw new Error('rename-procedure: expected function')

    return { ...fn, name }
  }, true),
  createBoostrapEntry('curry', 1, args => {
    const { car: fn } = args
    if (!R.isProcedure(fn))
      throw new Error('curry: expected function')
    return { ...fn, curried: fn.curried || [] }
  }),
  createBoostrapEntry('gensym', [0, 1], args => {
    let prefix = 'g'
    if (R.isCons(args)) {
      const { car } = args
      if (typeof car !== 'string')
        throw new Error('gensym: expected string prefix')
      prefix = car
    }

    return Symbol(`${prefix}${gensymCounter++}`)
  }),
  createBoostrapEntry('throw', 1, args => {
    const { car: message } = args
    if (typeof message !== 'string')
      throw new Error('throw: expected string message')
    const err = new Error(message)
    err.stack = undefined
    throw err
  }),
])

export const symboltable = pushTable({ parent: null, table: symboltableTable })

/**
 * Evaluates lisp and mutates the root/prelude symbol table
 * @param str
 */
export const rep = (str: string) =>
  readString(str).map(e => printExpression(evalFn(symboltable.parent!, e)))

// The standard library that can be defined using macros and the functions above in the symbol table

rep(preludeFile)
