import { last, reduceRightEager } from './iterable'
import produce from 'immer'
import { or, and, flip } from './match/functional'
import { Refinement } from './match/types'
import { printExpression } from './print'
import { SExpression, Cons, EmptyList, isEmptyList, empty } from './SExpression'

export interface ConsG<Car extends SExpression = SExpression, Cdr extends SExpression = SExpression> extends Cons {
  kind: 'cons'
  car: Car
  cdr: Cdr
}

export type List = EmptyList | Cons

export const isCons = (c: SExpression): c is Cons =>
  typeof c === 'object' && c.kind === 'cons'

export const isList: Refinement<SExpression, List> = or(isEmptyList, isCons)

/**
 * Predicate that determines if the SExpression is a cons chain terminated with '()
 * @param c
 */
export const isProperList = and(isList, (c: List) => isEmptyList(last(listToIterable(c))))

export const cons = (car: SExpression, cdr: SExpression): Cons => ({
  car,
  cdr,
  kind: 'cons',
})
export const consProper = (car: SExpression): Cons => cons(car, empty)

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
export function* listToIterable(c: SExpression, yieldLast: boolean = true) {
  let expr = c
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
export function* iterateCons(c: Cons) {
  let expr: SExpression = c
  while (isCons(expr)) {
    yield expr
    expr = expr.cdr
  }
}

export function cdr<A extends ConsG<any, any>>(v: A): A extends ConsG<any, infer C> ? C : never
export function cdr(v: List): SExpression
export function cdr(v: List): SExpression {
  if (isEmptyList(v))
    throw new Error(`cdr: ${printExpression(v)} has no cdr`)
  if (isCons(v)) return v.cdr
  throw new TypeError(`${printExpression(v)} is not a list`)
}
export function car<A extends ConsG<any, any>>(v: A): A extends ConsG<infer C, any> ? C : never
export function car(v: List): SExpression
export function car(v: List): SExpression {
  if (isEmptyList(v))
    throw new Error(`car: ${printExpression(v)} has no car`)
  if (isCons(v)) return v.car
  throw new TypeError(`${printExpression(v)} is not a list`)
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
  reduceRightEager(lists as Iterable<List>, flip(appendTwo), empty as SExpression)
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

export const appendTwo = (list1: List, list2: SExpression) => {
  if (isEmptyList(list1)) return list2
  if (isEmptyList(list2)) return list1
  // check if list1 is a list
  if (!isList(list1))
    throw new TypeError(`append: ${printExpression(list1)} is not a list`)

  // we must clone list1 to avoid modifing it
  // immer allows us to do this pretty efficiently,
  // but implementing sharing like Immutable uses
  // also, immer assumes our input to be a tree
  return produce(list1, draft => {
    const lastCons = last(iterateCons(draft))
    if (!isEmptyList(lastCons.cdr))
      throw new TypeError(`append: A proper list must not end with ${printExpression(lastCons.cdr)}`)
    lastCons.cdr = list2
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
  arr: SExpression[],
  options: FromArrayOptions = { notProper: false, nonEmpty: false }
): Cons | EmptyList {
  const { notProper, nonEmpty } = options
  if (arr.length === 0 && !nonEmpty)
    return empty
  else if (nonEmpty)
    throw new Error('Array must be non empty')
  const [first, ...rest] = arr
  let head = consProper(first)

  if (rest.length === 0) {
    if (!notProper) return head
    throw new Error('A cons list must have at least two elements')
  }

  let pointer = head
  for (let i = 0; i < rest.length - 1; ++i) {
    const next = rest[i]
    const nextCons = consProper(next)
    pointer.cdr = nextCons
    pointer = nextCons
  }
  const last = rest[rest.length - 1]
  pointer.cdr = notProper ? last : consProper(last)
  return head
}

export const unsafeLength = (xs: List): number => {
  let i = 0
  for (const _ of listToIterable(xs, false)) {
    i++
  }

  return i
}

export const map = (fn: (s: SExpression) => SExpression) => (list: List) => {
  let expr: SExpression = list
  const arr: SExpression[] = []
  while (isCons(expr)) {
    arr.push(fn(expr.car))
    expr = expr.cdr
  }
  return fromArray(arr)
}

export const reduce = <A extends SExpression>(fn: (p: A, c: A) => A, init: A, typeValidator?: Refinement<SExpression, A>) =>
  (list: SExpression) => {
    let acc = init
    for (const val of listToIterable(list, false)) {
      if (typeValidator && !typeValidator(val))
        throw new TypeError(`reduce: ${printExpression(val)} is not the correct type`)
      acc = fn(acc, val as A)
    }

    return acc
  }

export const reduce1 = <A extends SExpression>(fn: (p: A, c: A) => A, typeValidator: Refinement<SExpression, A>) =>
  (list: Cons) => {
    let acc = car(list)
    const rest = cdr(list)

    for (const val of listToIterable(rest, false)) {
      if (!typeValidator(acc))
        throw new TypeError(`reduce1: ${printExpression(acc)} is not the correct type`)
      if (!typeValidator(val))
        throw new TypeError(`reduce1: ${printExpression(val)} is not the correct type`)
      acc = fn(acc, val)
    }

    return acc
  }

export const foldl = (fn: (p: SExpression, c: SExpression) => SExpression, init?: SExpression) =>
  (list: List) => {
    let { acc, expr } = typeof init !== 'undefined'
      ? { acc: init, expr: list as SExpression }
      : { acc: car(list), expr: cdr(list) }

    while (isCons(expr)) {
      acc = fn(acc, expr.car)
      expr = expr.cdr
    }

    return acc
  }

export const foldr = (fn: (p: SExpression, c: SExpression) => SExpression, init: SExpression) =>
  (list: List): SExpression => {
    if (isEmptyList(list)) return init
    // let { acc, expr } = typeof init !== 'undefined'
    //   ? { acc: init, expr: list as SExpression }
    //   : { acc: car(list), expr: cdr(list) }

    const x = car(list)
    const rest = cdr(list)

    return isList(rest) ? fn(x, foldr(fn, init)(rest)) : rest
  }
