import { last, reduceRightEager, reduce as reduceI, listParts } from './iterable'
import produce from 'immer'
import { flip } from './match/functional'
import { Overwrite, Predicate, Mutable } from './match/types'
import { printExpression } from './print'
import { SExpression, Cons, EmptyList, isEmptyList, empty, isSExpression } from './SExpression'

// All functions here should potentially handle invalid values because they will be used from external, user-provided js code

export interface ConsG<Car extends SExpression = SExpression, Cdr extends SExpression = SExpression> extends Cons {
  kind: 'cons'
  car: Car
  cdr: Cdr
}

type ProperPair = Overwrite<Cons, { proper: true }>

export type List = EmptyList | ProperPair

export const isCons = (c: unknown): c is Cons =>
  typeof c === 'object' && c !== null && (c as any).kind === 'cons'

/**
 * Predicate that determines if the SExpression is a cons chain terminated with '()
 * @param c
 */
export const isProperList = (v: unknown): v is List =>
  v === empty || (isCons(v) && v.proper)

export const cons = (car: unknown, cdr: unknown): Cons => {
  if (!isSExpression(car) || !isSExpression(cdr))
    throw new Error('cons: expected a valid value')
  return {
    car,
    cdr,
    proper: isCons(cdr) ? cdr.proper : cdr === empty,
    kind: 'cons',
  }
}

export const setCar = (pair: unknown, value: unknown) => {
  if (!isSExpression(pair) || !isSExpression(value) || !isCons(pair))
    throw new Error('setCar: expecting a valid value')

  ;(pair as Mutable<typeof pair>).car = value

  return pair
}

export const setCdr = (pair: unknown, value: unknown) => {
  if (!isSExpression(pair) || !isSExpression(value) || !isCons(pair))
    throw new Error('setCdr: expecting a valid value')

  ;(pair as Mutable<typeof pair>).cdr = value
  ;(pair as Mutable<typeof pair>).proper = isCons(value) && value.proper

  return pair
}

export const consProper = (car: SExpression): Cons => cons(car, empty)

export function cdr<A extends ConsG<any, any>>(v: A): A extends ConsG<any, infer C> ? C : never
export function cdr(v: unknown): SExpression
export function cdr(v: unknown): SExpression {
  if (!isSExpression(v))
    throw new Error('cdr: expecting a valid value')
  if (isEmptyList(v))
    throw new Error(`cdr: ${printExpression(v)} has no cdr`)
  if (isCons(v)) return v.cdr
  throw new Error(`cdr: ${printExpression(v)} is not a list`)
}

export function car<A extends ConsG<any, any>>(v: A): A extends ConsG<infer C, any> ? C : never
export function car(v: unknown): SExpression
export function car(v: unknown): SExpression {
  if (!isSExpression(v))
    throw new Error('car: expecting a valid value')
  if (isEmptyList(v))
    throw new Error(`car: ${printExpression(v)} has no car`)
  if (isCons(v)) return v.car
  throw new Error(`car: ${printExpression(v)} is not a list`)
}

/**
 * Iterates over the values of a cons list
 *
 * Converts a cons into an iterable whose
 * elements are every car of the cons and the final cdr
 *
 * Does not follow tree-like cons structures
 *
 * ```ts
 * given (1 . (2 . (3 . nil)))
 * 1 2 3 nil
 * ```
 *
 * @param c a cons
 */
export function* listToIterable(c: unknown, yieldLast = false) {
  if (!isSExpression(c))
    throw new Error('listToIterable: expected valid value')

  let expr: SExpression = c
  while (isCons(expr)) {
    yield expr.car
    expr = expr.cdr
  }

  if (yieldLast) yield expr
}

/**
 * Iterates over the cons pairs of a cons list
 * ```ts
 * given (1 . (2 . (3 . nil)))
 * (1 . (2 . (3 . nil)))
 * (2 . (3 . nil))
 * (3 . nil)
 * ```
 *
 * @param c a cons
 */
export function* iterateCons(c: unknown) {
  if (!isSExpression(c))
    throw new Error('iterateCons: expected valid value')

  let expr: SExpression = c
  while (isCons(expr)) {
    yield expr
    expr = expr.cdr
  }
}

// really the type should be (...lists: List[], lastList: SExpression)
// or (...lists: [...List[], SExpression])
// but we cant have a non-rest param follow a rest
// and there's no way to express that the type of last element of
// an array can be an SExpression
/**
 * the last argument may be any object,
 * the remaining arguments must be proper lists
 */
export const append = (lists: Iterable<SExpression>) =>
  reduceRightEager(lists as Iterable<List>, flip(appendTwo) as typeof appendTwo, empty as SExpression)
  /*
    we reduce over the right because that should shorten
    the length of the linked list that we have to traverse

    left fold on (append '(1 2) '(3 4) '(5 6) '(7 8)):
      ((([]
        `appendTwo` [1,2])
          `appendTwo` [3,4])
            `appendTwo` [5,6])
              `appendTwo` [7,8]

      call 1: (list1: nil, list2: '(1 2))
      call 2: (list1: '(1 2), list2: '(3 4))
      call 3: (list1: '(1 2 3 4), list2: '(5 6))
      call 4: (list1: '(1 2 3 4 5 6), list2: '(7 8))
      '(1 2 3 4 5 6 7 8)

    we have to traverse the to the last cdr of the list1 parameter for every
      call, which increases time complexity as the size of our variadic list
      parameter increases. Compare this to the right fold:

    right fold on (append '(1 2) '(3 4) '(5 6) '(7 8)):
      [1,2] `appendTwo`
        ([3,4] `appendTwo`
          ([5,6] `appendTwo`
            ([7,8] `appendTwo` [])))
      '(1 2 3 4 5 6 7 8)
  */

export const appendTwo = (list1: unknown, list2: unknown) => {
  if (!isSExpression(list1) || !isSExpression(list2))
    throw new Error('appendTwo: expected a valid value')
  if (isEmptyList(list1)) return list2
  if (isEmptyList(list2)) return list1
  // check if list1 is a list
  if (!isProperList(list1))
    throw new TypeError(`append: ${printExpression(list1)} is not a list`)

  // we must clone list1 to avoid modifing it
  // immer allows us to do this pretty efficiently,
  // but implementing sharing like Immutable uses
  // also, immer assumes our input to be a tree
  return produce(list1, draft => {
    const lastCons = last(iterateCons(draft))
    if (!isProperList(lastCons))
      throw new TypeError(`append: A proper list must not end with ${printExpression(lastCons.cdr)}`)
    setCdr(lastCons, list2)
  })
}

export interface FromArrayOptions {
  notProper?: boolean
  nonEmpty?: boolean
}

export function fromArray(
  arr: [SExpression, ...SExpression[]],
  options?: { notProper?: boolean, nonEmpty?: true }
): Cons
export function fromArray(
  arr: [],
  options?: FromArrayOptions
): EmptyList
export function fromArray(
  arr: SExpression[],
  options?: FromArrayOptions
): Cons | EmptyList
export function fromArray(
  arr: unknown[],
  options: FromArrayOptions = { notProper: false, nonEmpty: false }
): Cons | EmptyList {
  const { notProper, nonEmpty } = options

  if (arr.length === 0 && !nonEmpty)
    return empty
  else if (nonEmpty)
    throw new Error('fromArray: array must be non empty')

  const [first, ...rest] = arr
  if (!isSExpression(first))
    throw new Error('fromArray: expected a valid value')

  let head = consProper(first)

  if (rest.length === 0) {
    if (!notProper) return head
    throw new Error('fromArray: a cons list must have at least two elements')
  }

  let pointer = head
  for (let i = 0; i < rest.length - 1; ++i) {
    const next = rest[i]
    if (!isSExpression(next))
      throw new Error('fromArray: expected a valid value')
    const nextCons = consProper(next)
    setCdr(pointer, nextCons)
    pointer = nextCons
  }
  const last = rest[rest.length - 1]
  if (!isSExpression(last))
    throw new Error('fromArray: expected a valid value')
  setCdr(pointer, notProper ? last : consProper(last))
  return head
}

export const reduce = (
  fn: (p: SExpression, c: SExpression) => unknown,
  init: unknown,
  typeValidator?: Predicate<SExpression>
) => (list: unknown) => {
  if (!isSExpression(init))
    throw new Error('reduce: expected a valid initial value')

  return reduceI(listToIterable(list, false), (acc, curr) => {
    const val = fn(acc, curr)
    if (!isSExpression(val) || (typeValidator && !typeValidator(val)))
      throw new Error('reduce: fn did not return a valid value')
    return val
  }, init)
}

export const reduce1 = (
  fn: (p: SExpression, c: SExpression) => unknown,
  typeValidator?: Predicate<SExpression>
) => (list: unknown) => {
  if (!isSExpression(list) || !isCons(list))
    throw new Error('reduce1: expected a cons for list')

  let acc = car(list)
  const rest = cdr(list)

  return reduce(fn, acc, typeValidator)(rest)
}

export const reduceRight = (
  fn: (p: SExpression, c: SExpression) => unknown,
  init: unknown,
  typeValidator?: Predicate<SExpression>
) => (list: unknown) => {
  if (!isSExpression(init))
    throw new Error('reduceRight: expected a valid initial value')

  return reduceRightEager(listToIterable(list, false), (a, b) => {
    const val = fn(a, b)
    if (!isSExpression(val) || (typeValidator && !typeValidator(val)))
      throw new Error('reduceRight: fn did not return a valid value')
    return val
  }, init)
}

export const reduceRight1 = (
  fn: (p: SExpression, c: SExpression) => unknown,
  typeValidator?: Predicate<SExpression>
) => (list: unknown) => {
  if (!isSExpression(list) || !isCons(list))
    throw new Error('reduceRight1: expected a cons for list')

  const { init: begin, last } = listParts(listToIterable(list, false), { last: true, init: true })

  return reduceRightEager(begin, (a, b) => {
    const val = fn(a, b)
    if (!isSExpression(val) || (typeValidator && !typeValidator(val)))
      throw new Error('reduceRight1: fn did not return a valid value')
    return val
  }, last)
}

export const map = (fn: (s: SExpression) => unknown) => (list: unknown) => {
  if (!isSExpression(list))
    throw new Error('map: expected a valid value')

  let expr: SExpression = list
  const arr: SExpression[] = []

  while (isCons(expr)) {
    const val = fn(expr.car)
    if (!isSExpression(val))
      throw new Error('map: expected fn to return a valid value')
    arr.push(val)
    expr = expr.cdr
  }
  return fromArray(arr)
}

export const unsafeLength = (xs: unknown): number => {
  let i = 0
  for (const _ of listToIterable(xs, false)) i++
  return i
}
