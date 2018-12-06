import { SExpression, printExpression } from "./interpreter"
import { last } from "./iterable"
import produce from 'immer'
import { or, and } from "./match/functional"
import { Nil, isNil, nil } from './symboltable'

export type Cons = {
  kind: 'cons'
  car: SExpression
  cdr: SExpression
}

export type List = Nil | Cons

export const isCons = (c: SExpression): c is Cons =>
  typeof c === 'object' && c.kind === 'cons'

export const isList = or(isNil, isCons)

/**
 * 
 * @param c 
 */
export const isProperList = and(isList, (c: List) => isNil(last(listToIterable(c))))

export const cons = (car: SExpression, cdr: SExpression): Cons => ({
  car,
  cdr,
  kind: 'cons',
})
export const consProper = (car: SExpression): Cons => cons(car, nil)

/**
 * Iterates over the values of a cons list
 *
 * Converts a cons into an iterable whose
 * elements are every car of the cons and the final cdr
 * 
 * Does not follow tree-like cons structures
 * 
 * given (1 . (2 . (3 . nil)))
 * 1 2 3 nil
 * 
 * @param c a cons
 */
export function* listToIterable(c: List, yieldLast: boolean = true) {
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
 * (3 . nil)```
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

export const cdr = (v: List) => isNil(v) ? v : v.cdr
export const car = (v: List) => isNil(v) ? v : v.car
// really the type should be (...lists: List[], lastList: SExpression)
// or (...lists: [...List[], SExpression])
// but we cant have a non-rest param follow a rest
// and there's no way to express that the type of last element of
// an array can be an SExpression
/**
 * the last argument may be any object,
 * the remaining arguments must be proper lists
 */
export const append = (...lists: List[]) => {
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
 return lists.reduceRight((p, c) => appendTwo(c, p), nil as SExpression)
}
export const appendTwo = (list1: List, list2: SExpression) => {
  if (isNil(list1)) return list2
  if (isNil(list2)) return list1
  // check if list1 is a list
  if (!isList(list1))
    throw new TypeError(`append: ${printExpression(list1)} is not a list`)

  // we must clone list1 to avoid modifing it
  // immer allows us to do this pretty efficiently,
  // but implementing sharing like Immutable uses
  // also, immer assumes our input to be a tree
  return produce(list1, draft => {
    const lastCons = last(iterateCons(draft as any))
    if (!isNil(lastCons.cdr))
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
  arr: SExpression[],
  options?: FromArrayOptions
): Cons | Nil
export function fromArray(
  arr: SExpression[],
  options: FromArrayOptions = { notProper: false, nonEmpty: false }
): Cons | Nil {
  const { notProper, nonEmpty } = options
  if (arr.length === 0 && !nonEmpty)
    return nil
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

export const map = (fn: (s: SExpression) => SExpression) =>
  produce<List>(draft => {
    // TODO: fix types in produce
    let expr: SExpression = draft as any
    while (isCons(expr)) {
      expr.car = fn(expr.car)
      expr = expr.cdr
    }
  })

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
    if (isNil(list)) return init
    // let { acc, expr } = typeof init !== 'undefined'
    //   ? { acc: init, expr: list as SExpression }
    //   : { acc: car(list), expr: cdr(list) }

    const x = car(list)
    const rest = cdr(list)
    
    return isList(rest) ? fn(x, foldr(fn, init)(rest)) : rest
  }