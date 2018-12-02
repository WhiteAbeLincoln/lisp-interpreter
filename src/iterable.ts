export const last = <A>(xs: IterableIterator<A>) => {
  const lst = [...xs]
  if (lst.length === 0) throw new Error('last: empty iterable')
  return lst[lst.length - 1]
}