import {
  isProperList, unsafeLength, isList, ConsG,
  isCons, reduce, cons, reduce1, listToIterable, car, cdr, fromArray
} from '../Cons'
import { printExpression } from '../print'
import { Nil, nil, t } from './common-symbols'
import { SExpression, Cons, BootstrapFn, isLambdaFn, isBoostrapFn, LambdaFn } from '../SExpression'
import { evalFn } from '../eval'
import { symExpr, Fn, add, div, sub, mult, gt, lt, lte, gte, eq, tuple } from '../util'

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

const accumulate = (op: Fn<[number, number], number>, identity: number) => (fncall: Cons): SExpression => {
  const { cdr: args } = fncall
  return reduce(op, identity, (x): x is number => typeof x === 'number')(args)
}

const accumulate1 = (op: Fn<[number, number], number>, identity: number) => (fncall: Cons): SExpression => {
  const { car: first, cdr: rest } = validate(fncall, [1, Infinity], false)
  if (typeof first !== 'number')
    throw new TypeError(`${printExpression(first)} is not a real number`)
  if (!isCons(rest)) return op(identity, first)
  return reduce1(op, (x): x is number => typeof x === 'number')(cons(first, rest))
}

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

const createBoostrapEntry = (symbol: symbol, body: Parameters<typeof createBoostrap>[0]) =>
  createSExprEntry(symbol, createBoostrap(body, symbol.description))

const symboltableTable: SymbolTable['table'] = new Map<symbol, SExpression>([
  createSExprEntry(t, t),
  createSExprEntry(nil, nil),
  createBoostrapEntry(symExpr('eval'), (fncall: Cons) => {
    const { car: arg } = validate(fncall, 1)
    return evalFn(symboltable, arg)
  }),
  createBoostrapEntry(symExpr('+'), accumulate(add, 0)),
  createBoostrapEntry(symExpr('-'), accumulate1(sub, 0)),
  createBoostrapEntry(symExpr('*'), accumulate(mult, 1)),
  createBoostrapEntry(symExpr('/'), accumulate1(div, 1)),
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
  createBoostrapEntry(symExpr('string-append'), fncall => {
    const { car: s1, cdr: { car: s2 } } = validate(fncall, 2)
    if (typeof s1 !== 'string' || typeof s2 !== 'string')
      throw new TypeError(`Cannot append ${printExpression(s1)} and ${printExpression(s2)} as they are not both strings`)
    return s1 + s2
  }),
])

export const symboltable = { parent: null, table: symboltableTable }
