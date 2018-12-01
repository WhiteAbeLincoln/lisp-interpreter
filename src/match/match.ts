import { tuple } from './functional'
import { any } from './predicates'
import { Refinement, RefinementTo, UnionOf, UnionToIntersection } from './types'

export type When<Ref extends Refinement<any, any>, C> = [
  Ref,
  (x: RefinementTo<Ref>) => C
]
export type ReturnValues<
  T extends Array<[Refinement<any, any>, (x: any) => any]>
> = ReturnType<T[number][1]>

export type ResultFn<T> = T extends [Refinement<any, any>, (x: any) => any]
  ? (x: RefinementTo<T[0]>) => ReturnType<T[1]>
  : never

export type ResultFns<
  T extends Array<[Refinement<any, any>, (x: any) => any]>
> = { [K in keyof T]: ResultFn<T[K]> }

export type ResultIntersection<
  T extends Array<(x: any) => any>
> = UnionToIntersection<UnionOf<T>>

export type InputValues<
  T extends Array<[Refinement<any, any>, (x: any) => any]>
> = RefinementTo<T[number][0]>

export class MatchError extends Error {
  constructor(readonly value: any, message?: string) {
    super(message || `match: No predicates matched value ${value}`)
  }
}

/**
 * The pattern matching function
 *
 * Patterns are represented by a tuple of a refinement predicate and a function on a type.
 * Patterns are evaluated in order of passed parameters.
 * An error is thrown if no patterns matched a given input
 * @param args patterns determined by a refinement predicate for a type and a function acting on that type
 */
export function match<T extends Array<[Refinement<any, any>, (x: any) => any]>>(
  ...args: T
): ResultIntersection<ResultFns<T>>
export function match<T extends Array<[Refinement<any, any>, (x: any) => any]>>(
  ...args: T
): ResultIntersection<ResultFns<T>>
export function match<T extends Array<[Refinement<any, any>, (x: any) => any]>>(
  ...args: T
): (x: InputValues<T>) => ReturnValues<T> {
  return x => {
    for (const [pred, fn] of args) {
      if (pred(x)) {
        return fn(x)
      }
    }

    throw new MatchError(x)
  }
}

/**
 * Creates a pattern for the pattern matching function
 * @param test a refinement predicate used to determine if a value has the type for this pattern
 * @param fn a function on a type
 */
export const when = <Ref extends Refinement<any, any>, C>(
  test: Ref,
  fn: (x: RefinementTo<Ref>) => C,
) => tuple(test, fn)

/**
 * A catch all pattern. Should be used last
 * @param fn a function on a type
 */
export const otherwise = <A, B extends A, C>(fn: (x: B) => C) =>
  when(any as Refinement<A, B>, fn)
