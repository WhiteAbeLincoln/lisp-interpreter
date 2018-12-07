export type Fn<A extends any[], R> = (...args: A) => R
export type Predicate<T> = (a: T) => boolean;
export type Refinement<A, B extends A> = (a: A) => a is B;
export const symDesc = (a: symbol) => (a as typeof a & { description?: string }).description

export const truthy = <T>(
  v: T
): v is Exclude<T, null | undefined | false | 0 | ""> => !!v;

/**
 * Forces the variadic list passed as `a` to be typed as a tuple
 * @param a
 */
export const tuple = <T extends any[]>(...a: T) => a;

export function filterMap<A, B>(
  xs: A[],
  filter: (x: A, idx: number, arr: A[]) => boolean,
  map: (x: A, idx: number, arr: A[]) => B): B[]
export function filterMap<A, B>(
  xs: Iterable<A> | A[],
  filter: (x: A) => boolean,
  map: (x: A) => B): B[]
export function filterMap<A, B>(
  xs: Iterable<A> | A[],
  filter: (x: A, idx: number, arr: A[]) => boolean,
  map: (x: A, idx: number, arr: A[]) => B
): B[] {
  const output: B[] = []
  const arr = Array.isArray(xs) ? xs : []
  let idx = 0

  for (const x of xs) {
    if (filter(x, idx, arr)) {
      output.push(map(x, idx, arr))
    }
    idx++
  }

  return output
}

export function mapFilter
  <A>(xs: A[]):
  <B>(map: (x: A, idx: number, arr: A[]) => B) =>
  <C extends B>(filter: (x: B, idx: number, arr: A[]) => x is C) => C[]
export function mapFilter
  <A>(xs: A[]):
  <B>(map: (x: A, idx: number, arr: A[]) => B) =>
  (filter: (x: B, idx: number, arr: A[]) => boolean) => B[]
export function mapFilter
  <A>(xs: Iterable<A> | A[]):
  <B>(map: (x: A) => B) =>
  <C extends B>(filter: (x: B) => x is C) => B[]
export function mapFilter
  <A>(xs: Iterable<A> | A[]):
  <B>(map: (x: A) => B) =>
  (filter: (x: B) => boolean) => B[]
export function mapFilter
  <A>(xs: Iterable<A> | A[]):
  <B>(map: (x: A, idx: number, arr: A[]) => B) =>
  <C extends B>(filter: (x: B, idx: number, arr: A[]) => boolean) => C[]
{
  return map => filter => {
    const output: any[] = []
    const arr = Array.isArray(xs) ? xs : []
    let idx = 0

    for (const x of xs) {
      const mapped = map(x, idx, arr)
      if (filter(mapped, idx, arr)) {
        output.push(mapped)
      }
      idx++
    }

    return output
  }
}
export const readStdin = () => {
  const stdin = process.stdin;
  let data = "";
  if (stdin.isTTY) {
    console.log("End input with ctrl-d");
  }

  return new Promise<string>(res => {
    stdin.setEncoding("utf8");
    stdin.on("readable", () => {
      let chunk;
      while (null !== (chunk = stdin.read())) {
        data += chunk;
      }
    });
    stdin.on("end", () => {
      res(data);
    });
  });
};

export const arrayReadFun = <T>(arr: T[]) => {
  const iter = arr[Symbol.iterator]();
  return () => iter.next().value || null;
};

export class Reader<T> {
  private buffer: T[] = [];
  private inputFinished = false;
  constructor(private readFun: () => T | null) {}
  get done() {
    return this.buffer.length === 0 && this.inputFinished;
  }
  peek(k = 1) {
    if (k > this.buffer.length) {
      let count = k;
      let val: T | null = null;

      while (
        count > 0 &&
        !this.inputFinished &&
        null !== (val = this.readFun())
      ) {
        this.buffer.push(val);
        count--;
      }

      if (val === null) {
        this.inputFinished = true;
      }
    }

    return this.buffer.slice(0, k);
  }
  read() {
    if (this.buffer.length > 0) {
      return this.buffer.shift();
    }

    const value = this.readFun();

    if (value === null) {
      this.inputFinished = true;
    }

    return value || undefined;
  }
}

export function compose<A, B, C>(bc: (b: B) => C, ab: (a: A) => B): (a: A) => C
export function compose<A, B, C, D>(cd: (c: C) => D, bc: (b: B) => C, ab: (a: A) => B): (a: A) => D
export function compose<A, B, C, D, E>(de: (d: D) => E, cd: (c: C) => D, bc: (b: B) => C, ab: (a: A) => B): (a: A) => E
export function compose<A, B, C, D, E, F>(
  ef: (e: E) => F,
  de: (d: D) => E,
  cd: (c: C) => D,
  bc: (b: B) => C,
  ab: (a: A) => B
): (a: A) => F
export function compose<A, B, C, D, E, F, G>(
  fg: (f: F) => G,
  ef: (e: E) => F,
  de: (d: D) => E,
  cd: (c: C) => D,
  bc: (b: B) => C,
  ab: (a: A) => B
): (a: A) => G
export function compose<A, B, C, D, E, F, G, H>(
  gh: (g: G) => H,
  fg: (f: F) => G,
  ef: (e: E) => F,
  de: (d: D) => E,
  cd: (c: C) => D,
  bc: (b: B) => C,
  ab: (a: A) => B
): (a: A) => H
export function compose<A, B, C, D, E, F, G, H, I>(
  hi: (h: H) => I,
  gh: (g: G) => H,
  fg: (f: F) => G,
  ef: (e: E) => F,
  de: (d: D) => E,
  cd: (c: C) => D,
  bc: (b: B) => C,
  ab: (a: A) => B
): (a: A) => I
export function compose<A, B, C, D, E, F, G, H, I, J>(
  ij: (i: I) => J,
  hi: (h: H) => I,
  gh: (g: G) => H,
  fg: (f: F) => G,
  ef: (e: E) => F,
  de: (d: D) => E,
  cd: (c: C) => D,
  bc: (b: B) => C,
  ab: (a: A) => B
): (a: A) => J
export function compose(...fns: Array<Function>): Function {
  const len = fns.length - 1
  return function(this: any, x: any) {
    let y = x
    for (let i = len; i > -1; i--) {
      y = fns[i].call(this, y)
    }
    return y
  }
}

export const id = <T>(x: T) => x

export const gt = (x: number, y: number) => x > y
export const gte = (x: number, y: number) => x >= y
export const lt = (x: number, y: number) => x < y
export const lte = (x: number, y: number) => x <= y
export const eq = (x: number, y: number) => x === y
export const add = (x: number, y: number) => x + y
export const sub = (x: number, y: number) => x - y
export const mult = (x: number, y: number) => x * y
export const div = (x: number, y: number) => x / y
