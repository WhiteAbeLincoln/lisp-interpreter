import { Refinement, Predicate, Equal, Refinement1, UnionToIntersection, If, Fn } from './types'

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

export const flatten = <T>(v: T[][]): T[] => v.reduce((p, c) => [...p, ...c], [])

/**
 * Constructs a tuple type
 * @param args elements of the tuple
 */
export const tuple = <T extends any[]>(...args: T) => args

export function flip<R>(fn: <A, B>(a: A, b: B) => R): <A, B>(b: B, a: A) => R
export function flip<R>(fn: <A>(a: A, b: A) => R): <A>(b: A, a: A) => R
export function flip<Fixed, R>(
  fn: <A>(a: A, b: Fixed) => R,
): <A>(b: Fixed, a: A) => R
export function flip<Fixed, R>(
  fn: <B>(a: Fixed, b: B) => R,
): <B>(b: B, a: Fixed) => R
export function flip<Fixed1, Fixed2, R>(
  fn: Fn<[Fixed1, Fixed2], R>,
): Fn<[Fixed2, Fixed1], R>
export function flip<A, B, C>(fn: Fn<[A, B], C>): (b: B, a: A) => C {
  return (b, a) => fn(a, b)
}

export function compose<As extends any[], B, C>(
  bc: Fn<[B], C>,
  ab: Fn<As, B>,
): Fn<As, C>
export function compose<As extends any[], B, C, D>(
  cd: Fn<[C], D>,
  bc: Fn<[B], C>,
  ab: Fn<As, B>,
): Fn<As, D>
export function compose<As extends any[], B, C, D, E>(
  de: Fn<[D], E>,
  cd: Fn<[C], D>,
  bc: Fn<[B], C>,
  ab: Fn<As, B>,
): Fn<As, E>
export function compose<As extends any[], B, C, D, E, F>(
  ef: Fn<[E], F>,
  de: Fn<[D], E>,
  cd: Fn<[C], D>,
  bc: Fn<[B], C>,
  ab: Fn<As, B>,
): Fn<As, F>
export function compose<As extends any[], B, C, D, E, F, G>(
  fg: Fn<[F], G>,
  ef: Fn<[E], F>,
  de: Fn<[D], E>,
  cd: Fn<[C], D>,
  bc: Fn<[B], C>,
  ab: Fn<As, B>,
): Fn<As, G>
export function compose<As extends any[], B, C, D, E, F, G, H>(
  gh: Fn<[G], H>,
  fg: Fn<[F], G>,
  ef: Fn<[E], F>,
  de: Fn<[D], E>,
  cd: Fn<[C], D>,
  bc: Fn<[B], C>,
  ab: Fn<As, B>,
): Fn<As, H>
export function compose<As extends any[], B, C, D, E, F, G, H, I>(
  hi: Fn<[H], I>,
  gh: Fn<[G], H>,
  fg: Fn<[F], G>,
  ef: Fn<[E], F>,
  de: Fn<[D], E>,
  cd: Fn<[C], D>,
  bc: Fn<[B], C>,
  ab: Fn<As, B>,
): Fn<As, I>
export function compose<As extends any[], B, C, D, E, F, G, H, I, J>(
  ij: Fn<[I], J>,
  hi: Fn<[H], I>,
  gh: Fn<[G], H>,
  fg: Fn<[F], G>,
  ef: Fn<[E], F>,
  de: Fn<[D], E>,
  cd: Fn<[C], D>,
  bc: Fn<[B], C>,
  ab: Fn<As, B>,
): Fn<As, J>
export function compose(...fns: Array<Function>): Function {
  const len = fns.length - 1
  return function(this: any, ...args: any[]) {
    let y = args
    for (let i = len; i > -1; i--) {
      y = [fns[i].call(this, ...y)]
    }
    return y[0]
  }
}
