import { andT, all, and, or } from './functional'
import {
  Refinement,
  RefinementTo,
  Overwrite,
  RefinementFrom,
  Shift,
  Push,
  First,
  Last,
} from './types'
import { Repeat } from './util-types'

export type TypeName =
  | 'undefined'
  | 'object'
  | 'boolean'
  | 'number'
  | 'string'
  | 'symbol'
  | 'function'

export type TypeFromName<
  T
> = T extends 'undefined' ? undefined      // prettier-ignore
  : T extends 'object'    ? object | null  // prettier-ignore
  : T extends 'boolean'   ? boolean        // prettier-ignore
  : T extends 'number'    ? number         // prettier-ignore
  : T extends 'string'    ? string         // prettier-ignore
  : T extends 'symbol'    ? symbol         // prettier-ignore
  : T extends 'function'  ? (...args: any[]) => any // prettier-ignore
  : never // prettier-ignore

export type Primitives = string | number | boolean | symbol

/**
 * Refinement function for typeof
 * @param type any string used with the typeof operator
 * @returns a refinement function that returns `typeof v === type`
 */
export const typeOf = <T extends TypeName>(
  type: T,
): Refinement<any, TypeFromName<T>> => (v): v is TypeFromName<T> =>
  typeof v === type

/**
 * Refines the type of a value to null
 * @param x a value of any type
 */
export const isNull: Refinement<any, null> = (x): x is null => x === null

/**
 * Refines the type of a value to undefined
 */
export const isUndefined = typeOf('undefined')

/**
 * Refines the type of a value to null | undefined
 */
export const missing = or(typeOf('undefined'), isNull)

/**
 * Extends a refinement predicate to refine to some type | undefined
 * @param pred a refinement predicate
 */
export const optional = <A, B extends A>(pred: Refinement<A, B>) =>
  or(typeOf('undefined'), pred)

/**
 * Extends a refinement predicate to refine to some type | null
 * @param pred a refinement predicate
 */
export const nullable = <A, B extends A>(pred: Refinement<A, B>) =>
  or(isNull, pred)

/**
 * Extends a refinement predicate to refine to some type | null | undefined
 * @param pred a refinement predicate
 */
export const maybeable = <A, B extends A>(pred: Refinement<A, B>) =>
  or(missing, pred)

/**
 * A refinement predicate to a literal value
 * @param expected a value with type extending one of the primitive types
 */
export const literal = <T extends Primitives>(
  expected: T,
): Refinement<any, T> => (x): x is T => expected === x

/**
 * A refinement predicate to a class
 * @param constructor the constructor for a class
 */
export const instanceOf = <T>(
  constructor: new (...args: any[]) => T,
): Refinement<any, T> => (x): x is T => x instanceof constructor

/**
 * A refinement predicate to an object ({})
 * @param x a value with any type
 */
export const object: Refinement<any, object> = (x): x is object => {
  // Honestly stolen from https://github.com/lodash/lodash/blob/master/isObject.js
  // and https://github.com/lostintime/node-typematcher/blob/master/src/lib/matchers.ts
  const type = typeof x
  return x != null && (type === 'object' || type === 'function')
}

/**
 * A refinement predicate to an array of any type
 * @param x a value with any type
 */
export const array: Refinement<any, any[]> = (x): x is any[] => Array.isArray(x)

/**
 * A refinement predicate that never refines
 * @param _x a value with any type
 */
export const never: Refinement<any, never> = (_x): _x is never => false

/**
 * A refinement predicate that always refines to unknown
 * @param _x a value with any type
 */
export const unknown: Refinement<any, unknown> = (_x): _x is unknown => true

/**
 * A refinement predicate that always refines to any
 * @param _x a value with any type
 */
export const any: Refinement<any, any> = (_x): _x is any => true

/**
 * A refinement predicate from any array to an array with the given length
 * @param n a number
 */
export const hasLength = <T extends number>(
  n: T,
): Refinement<any[], Repeat<any, T>> => (xs): xs is Repeat<any, T> =>
  xs.length === n

/**
 * A refinement predicate from any to an array with a specific inner type
 * @param pred A refinement predicate for the array's inner type
 */
export const arrayOf = <B extends A, A>(pred: Refinement<A, B>) =>
  andT(array, all(pred))

/**
 * Probably an over-complicated way of taking a tuple of Refinements
 * and returning a tuple of `([refined from types], [refined to types])`
 * This ensures that the resulting tuple `[From, To]` follows `[From, To extends From]`
 *
 * TODO: find a way to do this that is less taxing on the compiler
 * if we had some way of changing a union to a tuple, we could do
 * T extends Array<Refinement<infer From, infer To>> ? [ToTuple<From>, ToTuple<To>] : never
 */
export type RefTuple<
  Ref extends Array<Refinement<any, any>>,
  OutRef extends Refinement<any, any> = Refinement<[], []>
> = {
  empty: OutRef extends Refinement<infer From, infer To> ? [From, To] : never
  next: RefTuple<
    Shift<Ref>,
    Refinement<
      Push<RefinementFrom<OutRef>, RefinementFrom<Ref[0]>>,
      Push<RefinementTo<OutRef>, RefinementTo<Ref[0]>>
    >
  >
}[Ref extends [] ? 'empty' : 'next']

/**
 * Refines a tuple of wide types to a tuple of types extending those types
 * @param preds a list of type predicates
 */
export const tupleIs = <
  T extends Array<Refinement<any, any>>,
  RT = RefTuple<T>
>(
  ...preds: T
): Refinement<First<RT>, Last<RT>> => (xs): xs is Last<RT> =>
  ((xs as unknown) as any[]).every((x, i) => preds[i](x))

/**
 * A refinement predicate from any to a specific tuple
 * @param preds a tuple of predicates for the tuple's inner type at each index
 */
export const tupleOf = <T extends Array<Refinement<any, any>>>(
  ...preds: T
): Refinement<any, { [K in keyof T]: RefinementTo<T[K]> }> =>
  and(andT(array, hasLength(preds.length)), tupleIs(...preds))

type ObjectMatcher<T> = { [P in keyof T]-?: Refinement<unknown, T[P]> }

type OptionalPropNames<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never
}[keyof T]
type OptionalProps<T> = Pick<T, OptionalPropNames<T>>
type UndefinedToOptional<T> = Overwrite<T, Partial<OptionalProps<T>>>

/**
 * A refinement predicate from any to an object with some shape
 * @param matcher an object with members as refinement predicates from any type to a type for the member's key
 * @param optional allow the predicate to pass if any member predicate passes
 */
export function objectOf<T>(
  matcher: ObjectMatcher<T>,
  optional: true,
): Refinement<any, Partial<T>>
export function objectOf<T>(
  matcher: ObjectMatcher<T>,
  optional?: false,
): Refinement<any, UndefinedToOptional<T>>
export function objectOf<T>(
  matcher: ObjectMatcher<T>,
  optional: boolean,
): Refinement<any, T | Partial<T>>
export function objectOf<T>(
  matcher: ObjectMatcher<T>,
  optional = false,
): Refinement<any, T> {
  return (x): x is T => {
    if (!object(x)) return false

    for (const key in matcher) {
      if (!matcher.hasOwnProperty(key)) continue
      const v = x.hasOwnProperty(key) ? (x as any)[key] : undefined

      if (!matcher[key](v)) {
        return optional && typeof v !== 'undefined'
      }
    }

    return true
  }
}

/**
 * A refinement predicate from any to an object where all members share a specific type
 * @param pred a refinement predicate from any type to the type of every field in the desired object
 */
export const recordOf = <T>(
  pred: Refinement<unknown, T>,
): Refinement<any, Record<keyof any, T>> => (x): x is Record<keyof any, T> => {
  if (!object(x)) return false

  for (const key in x) {
    if (!x.hasOwnProperty(key)) continue
    if (!pred((x as any)[key])) {
      return false
    }
  }

  return true
}
