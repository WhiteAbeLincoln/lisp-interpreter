// tslint:disable:interface-over-type-literal
import * as utils from './util-types'

export type Fn<A extends any[], R> = (...args: A) => R

/**
 * Use to prevent a usage of type `T` from being inferred in other generics.
 * Borrowed from @pelotom's `type-zoo`
 *
 * Example:
 * `declare function assertEqual<T>(actual: T, expected: NoInfer<T>): boolean;`
 *
 * Type `T` will now only be inferred based on the type of the `actual` param, and
 * the `expected` param is required to be assignable to the type of `actual`.
 * This allows you to give one particular usage of type `T` full control over how the
 * compiler infers type `T`.
 *
 * @see https://github.com/pelotom/type-zoo/#noinfert
 * @see https://github.com/Microsoft/TypeScript/issues/14829#issuecomment-322267089
 */
export type NoInfer<T> = T & { [K in keyof T]: T[K] }
export type Lazy<A> = () => A
export type Predicate<A> = (a: A) => boolean
export type Refinement<A, B extends A> = (a: A) => a is B
export type Refinement1<A, B> = [B] extends [A] ? (a: A) => a is B : never
export type RefinementTo<Fn> = Fn extends Refinement<any, infer To> ? To : never
export type RefinementFrom<Fn> = Fn extends Refinement<infer From, any>
  ? From
  : never

export type ElementOf<T extends any[]> = T extends Array<infer R> ? R : never
/**
 * Creates a union from the types of an Array or tuple
 */
export type UnionOf<T extends any[]> = T[number]

/**
 * Returns the length of an array or tuple
 */
export type LengthOf<T extends any[]> = T['length']

// prettier-ignore
export type Inc = { [i: number]: number; 0: 1; 1: 2; 2: 3; 3: 4; 4: 5; 5: 6; 6: 7; 7: 8; 8: 9; 9: 10; 10: 11; 11: 12; 12: 13; 13: 14; 14: 15; 15: 16; 16: 17; 17: 18; 18: 19; 19: 20; 20: 21; 21: 22; 22: 23; 23: 24; 24: 25; 25: number };
export type Matches<V, T> = V extends T ? '1' : '0'
export type Equal<V, T> = V extends T ? (T extends V ? '1' : '0') : '0'
export type If<T extends '1' | '0', Then, Else> = T extends '1' ? Then : Else

export interface LengthedArray<T extends any, N extends number>
  extends Array<T> {
  length: N
}

/**
 * Create a homogeneous tuple for a given type and size
 * @param T element type
 * @param N vector size
 * @returns a tuple type
 */
export type Vector<
  T,
  N extends number,
  I extends number = 0,
  Acc = LengthedArray<T, N>
> = {
  '1': Acc
  '0': Vector<T, N, Inc[I], Acc & { [P in I]: T }>
}[Matches<I, N>]

export type The<T, V extends T> = V

export type TupleIndexes<T extends any[]> = Exclude<keyof T, keyof any[]>
export type ParamsOf<T> = T extends (...args: infer R) => any ? R : never
export type ReturnOf<T> = T extends (...args: any[]) => infer R ? R : never

export type UnionToIntersection<U> = (U extends any
  ? (k: U) => void
  : never) extends ((k: infer I) => void)
  ? I
  : never

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
export type Overwrite<T, U> = Omit<T, keyof T & keyof U> & U
export type MakeKeysOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type KeysEqual<T, V> = { [k in keyof T]-?: Equal<T[k], V> extends '1' ? k : never }[keyof T]
export type KeysMatching<T, V> = { [k in keyof T]-?: Matches<T[k], V> extends '1' ? k : never }[keyof T]
export type KeysMatching1<T, V> = { [k in keyof T]-?: Matches<V, T[k]> extends '1' ? k : never }[keyof T]
export type UndefinedKeys<T> = KeysMatching1<T, undefined>
export type Mutable<T> = { -readonly [k in keyof T]: T[k] }

/**
 * Add an element to the end of a tuple
 * @example Append<[0, 1, 2], 'new'> → [0, 1, 2, 'new']
 */
export type Append<Tuple extends any[], Addend> = Reverse<
  Prepend<Reverse<Tuple>, Addend>
>

/**
 * Add an element to the beginning of a tuple
 * @example Prepend<[0, 1, 2], 'new'> → ['new', 0, 1, 2]
 */
export type Prepend<Tuple extends any[], Addend> = utils.Prepend<Tuple, Addend>

/**
 * Reverse a tuple
 * @example Reverse<[0, 1, 2]> → [2, 1, 0]
 */
export type Reverse<Tuple extends any[]> = utils.Reverse<Tuple>

/**
 * Concat two tuple into one
 * @example Concat<[0, 1, 2], ['a', 'b', 'c']> → [0, 1, 2, 'a', 'b', 'c']
 */
export type Concat<Left extends any[], Right extends any[]> = utils.Concat<
  Left,
  Right
>

/**
 * Repeat a certain type into a tuple
 * @example Repeat<'foo', 4> → ['foo', 'foo', 'foo', 'foo']
 * @warning To avoid potential infinite loop, Count must be an integer greater than or equal to 0
 */
export type Repeat<Type, Count extends number> = utils.Repeat<Type, Count, []>

export type Head<T extends any[]> = T extends []
  ? never
  : ((...x: T) => any) extends (x: infer X, ...rest: any[]) => any
  ? X
  : never

export { Tail } from './util-types'

export type Push<T extends any[], V> = Append<T, V>
export type Unshift<T extends any[], V> = Prepend<T, V>
export type Pop<T extends any[]> = utils.Pop<T>
export type Shift<T extends any[]> = utils.Tail<T>
export type First<T> = T extends any[] ? T[0] : never
export type Last<T> = utils.Last<T>
