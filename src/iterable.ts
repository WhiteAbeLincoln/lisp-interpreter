import { Predicate, Refinement, KeysMatching, MakeKeysOptional, UndefinedKeys } from './match/types'

export const last = <A>(xs: Iterable<A>) => {
  const lst = [...xs]
  if (lst.length === 0) throw new Error('last: empty iterable')
  return lst[lst.length - 1]
}

export const init = <A>(xs: Iterable<A>) => {
  const lst = [...xs]
  if (lst.length === 0) throw new Error('last: empty iterable')
  return lst.slice(0, lst.length - 1)
}

export function* tail<A>(xs: Iterable<A>) {
  let hitFirst = false
  for (const x of xs) {
    if (hitFirst)
      yield x
    else
      hitFirst = true
  }
  if (!hitFirst)
    throw new Error('tail: empty iterable')
}

export const head = <A>(xs: Iterable<A>) => {
  for (const x of xs) return x
  throw new Error('tail: empty iterable')
}

export type ListPartsOptions = { init?: true, head?: true, last?: true, tail?: true }
type ListPartsRetBase<A> = {
  init: Iterable<A>
  head: A
  last: A
  tail: Iterable<A>
}

export type ListPartsRet<
  A,
  Options extends ListPartsOptions,
  MatchingKeys extends keyof ListPartsOptions = keyof Options & keyof ListPartsOptions
  > = MakeKeysOptional<{ [K in MatchingKeys]: ListPartsRetBase<A>[K] }, UndefinedKeys<Pick<Options, MatchingKeys>>>

export function listParts<A, Options extends ListPartsOptions>(xs: Iterable<A>, options: Options): ListPartsRet<A, Options>
export function listParts<A>(xs: Iterable<A>, options?: ListPartsOptions): ListPartsRet<A, ListPartsOptions>
export function listParts<A>(xs: Iterable<A>, options: ListPartsOptions = { init: true, head: true, last: true, tail: true }): ListPartsRet<A, ListPartsOptions> {
  const onlyOne = Object.keys(options).filter(v => v === 'init' || v === 'head' || v === 'last' || v === 'tail').length === 1
  // since iterables are consumed when iterated, we must create an array copy - unless we only need to iterate once
  const arr = onlyOne ? xs : [...xs]
  const retMap: Partial<ListPartsRetBase<A>>= {}
  if (options.head)
    retMap.head = head(arr)
  if (options.tail)
    retMap.tail = tail(arr)
  if (options.init)
    retMap.init = init(arr)
  if (options.last)
    retMap.last = last(arr)
  return retMap
}

export function* map<A, B>(xs: Iterable<A>, fn: (x: A) => B) {
  for (const x of xs) {
    yield fn(x)
  }
}

export const every = <A, B extends A = A>(iter: Iterable<A>, pred: Predicate<A> | Refinement<A, B>): iter is Iterable<B> => {
  for (const x of iter) {
    if (!pred(x)) return false
  }
  return true
}

export const some = <A>(iter: Iterable<A>, pred: Predicate<A>) => {
  for (const x of iter) {
    if (pred(x)) return true
  }
  return false
}

export const reduce = <A, B>(iter: Iterable<A>, fn: (acc: B, curr: A) => B, init: B) => {
  let acc = init
  for (const x of iter) {
    acc = fn(acc, x)
  }

  return acc
}

export const reduceRight = <A, B>(it: Iterable<A>, fn: (acc: () => B, curr: A) => B, init: B) => {
  throw new Error('unimplemented')
}

export const reduceRightEager = <A, B>(it: Iterable<A>, fn: (acc: B, curr: A) => B, init: B) => {
  return [...it].reduceRight(fn, init)
}
