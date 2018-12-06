import { Refinement, Predicate, Equal, NoInfer, Refinement1, UnionToIntersection } from './types'

/**
 * The I or identity combinator
 * 
 * takes a value and returns it
 * @param a a value
 */
export const I = <A>(a: A) => a

export { I as id }

/**
 * The thrush combinator
 * 
 * takes a param `a` and applies it to the param `fn`
 * @param a a value
 */
export const T = <A>(a: A) => <B>(fn: (a: A) => B) => fn(a)

/**
 * The K combinator
 * 
 * takes two values and returns the first
 * @param a a value to be returned
 */
export const K = <A>(a: A) => <B>(_?: B) => a

export { K as constant }

/**
 * constant for `true`
 * @see constant
 */
export const constTrue = K<true>(true)
/**
 * constant for `false`
 * @see constant
 */
export const constFalse = K<false>(false)
/**
 * constant for `null`
 * @see constant
 */
export const constNull = K(null)
/**
 * constant for `undefined`
 * @see constant
 */
export const constUndefined = K(undefined)

export function all<A, B extends A>(
  pred: Refinement<A, B>,
): Refinement<A[], B[]>
export function all<A>(pred: Predicate<A>): Predicate<A[]>
export function all<A>(pred: Predicate<A>): Predicate<A[]> {
  return xs => xs.every(pred)
}

export function any<A>(pred: Predicate<A>): Predicate<A[]> {
  return xs => xs.every(pred)
}

export function not<A, B extends A>(
  pred: Refinement<A, B>,
): Refinement<A, Exclude<A, B>>
export function not<A>(pred: Predicate<A>): Predicate<A>
export function not<A>(pred: Predicate<A>): Predicate<A> {
  return a => !pred(a)
}

// we have the explicit two predicate case because predicates with generics don't work
// if passed into the variadic function
export function or<A, B extends A, B2 extends A>(
  pred1: Refinement<A, B>,
  pred2: Refinement<A, B2>,
): Refinement<A, B | B2>
export function or<A, B extends A, Bs extends A[]>(
  pred1: Refinement<A, B>,
  ...preds: ({ [k in keyof Bs]: Refinement1<A, Bs[k]> })
): Refinement<A, B | Bs[number]>
export function or<A, B extends A>(
  ...preds: Array<Predicate<A> | Refinement<A, B>>
): Predicate<A>
export function or<A>(...preds: Array<Predicate<A>>): Predicate<A> {
  return a => preds.some(T(a))
}

export type AndTransitive = <A, B extends A, C extends B>(
  ab: Refinement<A, B>,
  bc: Refinement<B, C>,
) => Refinement<A, C>
export type AndIntersection = <A,
  B1 extends A,
  B2 extends A,
  B extends A[] = [],
  Ret = Equal<B, []> extends '1' ? B1 & B2 : B1 & B2 & UnionToIntersection<B[number]>>(
  p1: Refinement<A, B1>,
  p2: Refinement<A, B2>,
  ...preds: ({ [k in keyof B]: Refinement1<A, B[k]> })
) => Refinement1<A, Ret>
export type AndPred = <A>(...preds: Array<Predicate<A>>) => Predicate<A>
export type AndPred1 = <A, B extends A = A>(
  p1: Predicate<A>,
  ...preds: Array<Predicate<A> | Refinement<A, B>>
) => Refinement<A, B>
export type AndPred2 = <A, B extends A>(
  p1: Refinement<A, B>,
  p2: Predicate<B>,
) => Refinement<A, B>
type AndFn = AndPred & AndPred1 & AndPred2 & AndTransitive & AndIntersection

/**
 * Transitive version of the and refinement
 *
 * predicate 1 refines type A to B, and predicate 2 refines B to C
 */
export const andT: AndTransitive = and
/**
 * Intersection version of the and refinement
 *
 * predicate 1 refines type A to B1, predicate 2 refines A to B2,
 * therefore if both pass, result is a refinement from A to B1 & B2
 */
export const andI: AndIntersection = and
export const andP: AndPred = and
export const andP1: AndPred1 = and
export const andP2: AndPred2 = and

export function and<A,
  B1 extends A,
  B2 extends A,
  B extends A[] = [],
  Ret = Equal<B, []> extends '1' ? B1 & B2 : B1 & B2 & UnionToIntersection<B[number]>>(
  p1: Refinement<A, B1>,
  p2: Refinement<A, B2>,
  ...preds: ({ [k in keyof B]: Refinement1<A, B[k]> })
): Refinement1<A, Ret>
export function and<A, B extends A, C extends B>(
  ab: Refinement<A, B>,
  bc: Refinement<B, C>,
): Refinement<A, C>
export function and<A, B extends A>(
  p1: Refinement<A, B>,
  p2: Predicate<B>,
): Refinement<A, B>
export function and<A, B extends A>(
  p1: Predicate<A>,
  p2: Refinement<A, B>,
): Refinement<A, B>
export function and<A, B extends A = A>(...preds: Array<Predicate<A> | Refinement<A, B>>): Refinement<A, B>
export function and<A>(...preds: Array<Predicate<A>>): Predicate<A> {
  return a => preds.every(T(a))
}

/**
 * Used for verification that and implementation overloads match AndFn type
 * @internal
 */
export const andVerify: Equal<AndFn, typeof and> = '1'

export const xor = <A>(p: Predicate<A>, q: Predicate<A>): Predicate<A> => a =>
  (p(a) && !q(a)) || (!p(a) && q(a))

/**
 * Constructs a tuple type
 * @param args elements of the tuple
 */
export const tuple = <T extends any[]>(...args: T) => args
