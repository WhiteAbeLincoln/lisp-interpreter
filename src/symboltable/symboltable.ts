import {
  isProperList, unsafeLength, isList, ConsG,
  isCons, reduce, cons, reduce1, listToIterable, car, cdr, fromArray, append
} from '../Cons'
import { printExpression } from '../print'
import { Nil, nil, t } from './common-symbols'
import { SExpression, Cons, BootstrapFn, isLambdaFn, isBoostrapFn, LambdaFn } from '../SExpression'
import { evalFn } from '../eval'
import { symExpr, add, div, sub, mult, gt, lt, lte, gte, eq, tuple, isInterned } from '../util'
import { reduce as reduceI } from '../iterable'
import { Predicate } from '../match/types'
import { lexer } from '../lexer'
import { parser } from '../parser'
import { Fn } from '../match/functional'

export type SymbolTable = { parent: SymbolTable | null, table: Map<symbol, SExpression> }

function* iterateTables(table: SymbolTable) {
  let tablePointer: SymbolTable['parent'] = table
  while (tablePointer !== null) {
    yield tablePointer.table
    tablePointer = tablePointer.parent
  }
}

export const getSymbol = (env: SymbolTable) => (name: symbol) => {
  for (const table of iterateTables(env)) {
    const existing = table.get(name)
    if (typeof existing !== 'undefined')
      return existing
  }
  throw new ReferenceError(`Symbol ${printExpression(name)} has no value`)
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

export function validate(fncall: Cons, arglen: [5, number], proper?: boolean): ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, SExpression>>>>>
export function validate(fncall: Cons, arglen: [4, number], proper?: boolean): ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, SExpression>>>>
export function validate(fncall: Cons, arglen: [3, number], proper?: boolean): ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, SExpression>>>
export function validate(fncall: Cons, arglen: [2, number], proper?: boolean): ConsG<SExpression, ConsG<SExpression, SExpression>>
export function validate(fncall: Cons, arglen: [1, number], proper?: boolean): ConsG<SExpression, SExpression>
export function validate(fncall: Cons, arglen: 5, proper?: true): ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, Nil>>>>>
export function validate(fncall: Cons, arglen: 4, proper?: true): ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, Nil>>>>
export function validate(fncall: Cons, arglen: 3, proper?: true): ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, Nil>>>
export function validate(fncall: Cons, arglen: 2, proper?: true): ConsG<SExpression, ConsG<SExpression, Nil>>
export function validate(fncall: Cons, arglen: 1, proper?: true): ConsG<SExpression, Nil>
export function validate(fncall: Cons, arglen: number | [number, number], proper?: true): Cons
export function validate(fncall: Cons, arglen: number | [number, number], proper?: boolean): SExpression
export function validate(fncall: Cons, arglen: number | [number, number], proper = true): SExpression {
  const { car: fnNameSym, cdr: args } = fncall
  const [min, max] = typeof arglen === 'number' ? [arglen, arglen] : arglen

  if (typeof fnNameSym !== 'symbol' && !isLambdaFn(fnNameSym) && !isBoostrapFn(fnNameSym))
    throw new Error(`Don't know how we got here, but function call name ${fnNameSym} is not a symbol or function`)
  const name = (fnNameSym as symbol).description || (fnNameSym as LambdaFn).name || '[lambda]'
  if (proper && !isProperList(args))
    throw new TypeError(`argument list given to ${name} is dotted: ${printExpression(fncall)}`)
  if (!isList(args)) {
    if (!Array.isArray(arglen)) return args
    throw new TypeError(`argument list given to ${name} is dotted: ${printExpression(fncall)}`)
  }

  // TODO: this can loop infinitely if args has a cycle
  const len = unsafeLength(args)
  if (len > max) {
    throw new TypeError(`too many arguments given to ${name}: ${printExpression(fncall)}`)
  } else if (len < min) {
    throw new TypeError(`too few arguments given to ${name}: ${printExpression(fncall)}`)
  }

  return args
}

const accumulate = <T extends SExpression>(op: Fn<[T, T], T>, identity: T, pred: (v: SExpression) => v is T) => (fncall: Cons): SExpression => {
  const { cdr: args } = fncall
  return reduce(op, identity, pred)(args)
}

const accumulate1 = <T extends SExpression>(op: Fn<[T, T], T>, identity: T, pred: (v: SExpression) => v is T) => (fncall: Cons): SExpression => {
  const { car: first, cdr: rest } = validate(fncall, [1, Infinity], false)
  if (!pred(first))
    throw new TypeError(`${printExpression(first)} is not the correct type`)
  if (!isCons(rest)) return op(identity, first)
  return reduce1(op, pred)(cons(first, rest))
}

const isNum = (v: SExpression): v is number => typeof v === 'number'

const compare = (op: Fn<[number, number], boolean>) => (fncall: Cons): SExpression => {
  const args = validate(fncall, [1, Infinity], false)

  const argsArr = [...listToIterable(args, false)]
  for (let i = 1; i < argsArr.length; i++) {
    const first = argsArr[i - 1]
    const second = argsArr[i]
    if (typeof first !== 'number')
      throw new TypeError(`${printExpression(first)} is not a number`)
    if (typeof second !== 'number')
      throw new TypeError(`${printExpression(second)} is not a number`)

    if (op(first, second)) continue
    else return nil
  }
  return t
}

const createBoostrap = (body: (fncall: Cons) => SExpression, name: string): BootstrapFn => ({
  kind: 'boostrap',
  name,
  body,
})

const createSExprEntry = (symbol: symbol, value: SExpression): [symbol, SExpression] => [symbol, value]

const createBoostrapEntry = <T extends string>(symbol: T | symbol, body: Parameters<typeof createBoostrap>[0]) => {
  const sym = typeof symbol === 'string' ? symExpr(symbol) : symbol
  return createSExprEntry(sym, createBoostrap(body, sym.description))
}

const createPred = <T extends string>(name: T | symbol, pred: Predicate<SExpression>) =>
  createBoostrapEntry(name, fncall => {
    const { car } = validate(fncall, 1)
    return pred(car) ? t : nil
  })

const symboltableTable: SymbolTable['table'] = new Map<symbol, SExpression>([
  createSExprEntry(t, t),
  createSExprEntry(nil, nil),
  createBoostrapEntry(symExpr('eval'), (fncall: Cons) => {
    const { car: arg } = validate(fncall, 1)
    return evalFn(symboltable, arg)
  }),
  createBoostrapEntry(symExpr('+'), accumulate(add, 0, isNum)),
  createBoostrapEntry(symExpr('-'), accumulate1(sub, 0, isNum)),
  createBoostrapEntry(symExpr('*'), accumulate(mult, 1, isNum)),
  createBoostrapEntry(symExpr('/'), accumulate1(div, 1, isNum)),
  createBoostrapEntry(symExpr('>'), compare(gt)),
  createBoostrapEntry(symExpr('<'), compare(lt)),
  createBoostrapEntry(symExpr('<='), compare(lte)),
  createBoostrapEntry(symExpr('>='), compare(gte)),
  createBoostrapEntry(symExpr('='), compare(eq)),
  createBoostrapEntry(symExpr('print'), fncall => {
    const { car: arg } = validate(fncall, 1)
    console.log(printExpression(arg))
    return arg
  }),
  createBoostrapEntry(symExpr('cons'), fncall => {
    const { car: first, cdr: { car: second } } = validate(fncall, 2)
    return cons(first, second)
  }),
  createBoostrapEntry(symExpr('car'), fncall => {
    const { car: arg } = validate(fncall, 1)
    if (!isList(arg))
      throw new TypeError(`${printExpression(arg)} is not a list`)
    return car(arg)
  }),
  createBoostrapEntry(symExpr('cdr'), fncall => {
    const { car: arg } = validate(fncall, 1)
    if (!isList(arg))
      throw new TypeError(`${printExpression(arg)} is not a list`)
    return cdr(arg)
  }),
  createBoostrapEntry(symExpr('list'), fncall => {
    const { cdr: args } = fncall
    if (!isCons(args)) return nil
    return fromArray([...listToIterable(args, false)])
  }),
  createBoostrapEntry(symExpr('list*'), fncall => {
    const args = validate(fncall, [2, Infinity])
    if (!isCons(args))
      throw new TypeError(`list*: Expecting cons, but recieved ${printExpression(args)}`)
    return fromArray([...listToIterable(args, false)], { notProper: true })
  }),
  createBoostrapEntry(symExpr('append'), fncall => {
    const args = validate(fncall, [0, Infinity])
    return append(listToIterable(args, false))
  }),
  createBoostrapEntry(symExpr('string-append'),
    accumulate1((a: string, b: string) => a + b, '', (v): v is string => typeof v === 'string')),
  createBoostrapEntry(symExpr('eq?'), fncall => {
    // Object reference equality
    const { car: o1, cdr: { car: o2 } } = validate(fncall, 2)
    return o1 === o2 ? t : nil
  }),
  createPred('pair?', isCons),
  createPred('list?', isProperList),
  createPred('number?', v => typeof v === 'number'),
  createPred('integer?', v => typeof v === 'number' && Number.isInteger(v)),
  createPred('string?', v => typeof v === 'string'),
  createPred('procedure?', v => typeof v === 'object' && (v.kind === 'boostrap' || v.kind === 'lambda')),
  createPred('symbol?', v => typeof v === 'symbol'),
  createPred('symbol-interned?', v => {
    if (typeof v !== 'symbol')
      throw new TypeError(`Expected symbol?, given ${printExpression(v)}`)
    return isInterned(v)
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
  createBoostrapEntry(symExpr('number->string'), fncall => {
    const { car: num, cdr } = validate(fncall, [1, 2])
    if (cdr !== nil && !isList(cdr))
      throw new TypeError(`number->string: Expected the options to be a hash-map`)

    if (typeof num !== 'number')
      throw new TypeError(`number->string: Expected number, but recieved ${printExpression(num)}`)

    // TODO: replace with a proper hash-map implementation
    const optionsIter = cdr === nil ? [] : listToIterable(car(cdr as Cons), false)
    console.log(cdr)
    type Options = { mode: 'radix' | 'fixed' | 'prec' | 'exp', param: number }
    const symbols = tuple(symExpr('radix'), symExpr('fixed'), symExpr('prec'), symExpr('exp'))

    const { mode, param } = reduceI(optionsIter, (acc, curr) => {
      console.log('Acc', acc, 'Curr', curr)
      if (!isCons(curr))
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
  createBoostrapEntry(symExpr('string->symbol'), fncall => {
    const { car: arg } = validate(fncall, 1)
    if (typeof arg !== 'string')
      throw new TypeError(`${printExpression(arg)} is not a string`)
    return symExpr(arg)
  }),
  createBoostrapEntry(symExpr('string->uninterned-symbol'), fncall => {
    const { car: arg } = validate(fncall, 1)
    if (typeof arg !== 'string')
      throw new TypeError(`${printExpression(arg)} is not a string`)
    return Symbol(arg)
  }),
  createBoostrapEntry(symExpr('symbol->string'), fncall => {
    const { car: arg } = validate(fncall, 1)
    if (typeof arg !== 'symbol')
      throw new TypeError(`Expected symbol?, given ${printExpression(arg)}`)
    return arg.description || '<Unknown Symbol>'
  }),
  createBoostrapEntry(symExpr('read/string'), fncall => {
    const { car: arg } = validate(fncall, 1)
    if (typeof arg !== 'string')
      throw new TypeError(`Expected string?, given ${printExpression(arg)}`)
    const arr = parser(lexer(arg))
    return arr.length === 1 ? arr[0] : fromArray(arr)
  }),
])

export const symboltable = { parent: null, table: symboltableTable }
