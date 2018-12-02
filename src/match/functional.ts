import { Lazy, Refinement, Predicate, Equal } from './types'

/**
 * The identity function
 * @param a a value
 */
export const id = <A>(a: A) => a
/**
 * Returns a function that always returns the given value
 * @param a a value
 */
export const constant = <A>(a: A): Lazy<A> => () => a
/**
 * constant for `true`
 * @see constant
 */
export const constTrue = constant<true>(true)
/**
 * constant for `false`
 * @see constant
 */
export const constFalse = constant<false>(false)
/**
 * constant for `null`
 * @see constant
 */
export const constNull = constant<null>(null)
/**
 * constant for `undefined`
 * @see constant
 */
export const constUndefined = constant(undefined)

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

type OrRefine = <A, B1 extends A, B2 extends A>(
  p1: Refinement<A, B1>,
  p2: Refinement<A, B2>,
) => Refinement<A, B1 | B2>
type OrPred = <A>(p1: Predicate<A>, p2: Predicate<A>) => Predicate<A>
type OrPred1 = <A, B extends A>(
  p1: Refinement<A, B>,
  p2: Predicate<A>,
) => Predicate<A>
type OrPred2 = <A, B extends A>(
  p1: Predicate<A>,
  p2: Refinement<A, B>,
) => Predicate<A>
type OrFn = OrRefine & OrPred & OrPred1 & OrPred2

/**
 * Refinement version of the or predicate
 */
export const orR: OrRefine = or
export const orP: OrPred = or
export const orP1: OrPred1 = or
export const orP2: OrPred2 = or

export function or<A, B1 extends A, B2 extends A>(
  p1: Refinement<A, B1>,
  p2: Refinement<A, B2>,
): Refinement<A, B1 | B2>
export function or<A, B extends A>(
  p1: Refinement<A, B>,
  p2: Predicate<A>,
): Predicate<A>
export function or<A, B extends A>(
  p1: Predicate<A>,
  p2: Refinement<A, B>,
): Predicate<A>
export function or<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A>
export function or<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A> {
  return a => p1(a) || p2(a)
}

/**
 * Used for verification that or implementation overloads match OrFn type
 * @internal
 */
export const orVerify: Equal<OrFn, typeof or> = '1'

export type AndTransitive = <A, B extends A, C extends B>(
  ab: Refinement<A, B>,
  bc: Refinement<B, C>,
) => Refinement<A, C>
export type AndIntersection = <A, B1 extends A, B2 extends A>(
  p1: Refinement<A, B1>,
  p2: Refinement<A, B2>,
) => Refinement<A, B1 & B2>
export type AndPred = <A>(p1: Predicate<A>, p2: Predicate<A>) => Predicate<A>
export type AndPred1 = <A, B extends A>(
  p1: Predicate<A>,
  p2: Refinement<A, B>,
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

export function and<A, B1 extends A, B2 extends A>(
  p1: Refinement<A, B1>,
  p2: Refinement<A, B2>,
): Refinement<A, B1 & B2>
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
export function and<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A>
export function and<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A> {
  return (a: A) => p1(a) && p2(a)
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
