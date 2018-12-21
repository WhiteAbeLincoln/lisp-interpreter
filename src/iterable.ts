import { Predicate, Refinement } from './match/types'

export const last = <A>(xs: Iterable<A>) => {
  const lst = [...xs]
  if (lst.length === 0) throw new Error('last: empty iterable')
  return lst[lst.length - 1]
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
