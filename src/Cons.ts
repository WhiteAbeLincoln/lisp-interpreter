import { SExpression, isNil, nil, Nil, printExpression } from "./interpreter"
import { last } from "./iterable"
import produce from 'immer'
import { or, and } from "./match/functional"

export type Cons = {
  kind: 'cons'
  car: SExpression
  cdr: SExpression
  [Symbol.toStringTag]: 'cons'
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

export const cons = (car: SExpression, cdr: SExpression): Cons => ({ car, cdr, kind: 'cons', [Symbol.toStringTag]: 'cons' })
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
export function* listToIterable(c: List) {
  let expr: SExpression = c
  while (isCons(expr)) {
    yield expr.car
    expr = expr.cdr
  }
  yield expr
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
  if (!isList(list1)) throw new TypeError(`append: ${printExpression(list1)} is not a list`)

  // we must clone list1 to avoid modifing it
  // immer allows us to do this pretty efficiently,
  // but implementing sharing like Immutable uses
  // also, immer assumes our input to be a tree
  return produce(list1, draft => {
    const lastCons = last(iterateCons(draft as any))
    if (!isNil(lastCons.cdr)) throw new TypeError(`append: A proper list must not end with ${printExpression(lastCons.cdr)}`)
    lastCons.cdr = list2
  })
}

export const fromArray = (arr: SExpression[], nilTerminated = false): Cons | Nil => {
  if (arr.length === 0) return nil
  const [first, ...rest] = arr
  let head = consProper(first)

  if (rest.length === 0) {
    if (!nilTerminated) return head
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
  pointer.cdr = !nilTerminated ? consProper(last) : last
  return head
}
