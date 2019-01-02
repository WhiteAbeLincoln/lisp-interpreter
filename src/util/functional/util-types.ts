export type Tail<T extends any[]> = T extends []
  ? never
  : ((...x: T) => any) extends (x: any, ...rest: infer XS) => any
  ? XS
  : never

export type IsFinite<Tuple extends any[], Finite, Infinite> = {
  empty: Finite
  nonEmpty: ((..._: Tuple) => any) extends ((_: any, ..._1: infer Rest) => any)
    ? IsFinite<Rest, Finite, Infinite>
    : never
  infinite: Infinite
}[Tuple extends []
  ? 'empty'
  : Tuple extends Array<infer Element>
    ? Element[] extends Tuple ? 'infinite' : 'nonEmpty'
    : never]

export type Prepend<T extends any[], Add> = ((x: Add, ...t: T) => any) extends (
  ...args: infer T2
) => any
  ? T2
  : never

export type Reverse<Tuple extends any[], Prefix extends any[] = []> = {
  empty: Prefix
  nonEmpty: ((..._: Tuple) => any) extends ((
    _: infer First,
    ..._1: infer Next
  ) => any)
    ? Reverse<Next, Prepend<Prefix, First>>
    : never
  infinite: {
    ERROR: 'Cannot reverse an infinite tuple'
    CODENAME: 'InfiniteTuple'
  }
}[Tuple extends [any, ...any[]]
  ? IsFinite<Tuple, 'nonEmpty', 'infinite'>
  : 'empty']

export type Concat<Left extends any[], Right extends any[]> = {
  emptyLeft: Right
  singleLeft: Left extends [infer SoleElement]
    ? Prepend<Right, SoleElement>
    : never
  multiLeft: ((..._: Reverse<Left>) => any) extends ((
    _: infer LeftLast,
    ..._1: infer ReversedLeftRest
  ) => any)
    ? Concat<Reverse<ReversedLeftRest>, Prepend<Right, LeftLast>>
    : never
  infiniteLeft: {
    ERROR: 'Left is not finite'
    CODENAME: 'InfiniteLeft' & 'Infinite'
  }
}[Left extends []
  ? 'emptyLeft'
  : Left extends [any]
    ? 'singleLeft'
    : IsFinite<Left, 'multiLeft', 'infiniteLeft'>]

export type Repeat<
  Type,
  Count extends number,
  Holder extends any[] = []
> = Count extends never
  ? never
  : number extends Count
    ? Type[]
    : {
        fit: Holder
        unfit: Repeat<Type, Count, Prepend<Holder, Type>>
        union: Count extends Holder['length'] | infer Rest
          ? Rest extends number
            ? Repeat<Type, Holder['length']> | Repeat<Type, Rest>
            : never
          : never
      }[Holder['length'] extends Count // It is possible for Count to be a union
        ? Count extends Holder['length'] // Make sure that Count is not a union
          ? 'fit'
          : 'union'
        : 'unfit']

export type Pop<Tuple extends any[]> = {
  infinite: Tuple
  empty: Tuple
  single: []
  finite: Reverse<Tail<Reverse<Tuple>>>
}[Tuple extends []
  ? 'empty'
  : Tuple extends [any] ? 'single' : IsFinite<Tuple, 'finite', 'infinite'>]

export type Last<Tuple, Default = never> = {
  empty: Default
  single: Tuple extends [infer SoleElement] ? SoleElement : never
  multi: Tuple extends any[]
    ? (((..._: Tuple) => any) extends ((_: any, ..._1: infer Next) => any)
        ? Last<Next>
        : Default)
    : never
  infinite: Tuple extends Array<infer Element> ? Element : never
}[Tuple extends []
  ? 'empty'
  : Tuple extends [any]
    ? 'single'
    : Tuple extends Array<infer Element>
      ? Element[] extends Tuple ? 'infinite' : 'multi'
      : never]
