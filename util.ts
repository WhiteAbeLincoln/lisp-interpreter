export type Predicate<T> = (a: T) => boolean;
export type Refinement<A, B extends A> = (a: A) => a is B;

/**
 * Forces the variadic list passed as `a` to be typed as a tuple
 * @param a
 */
export const tuple = <T extends any[]>(...a: T) => a;
export const not = <A>(predicate: Predicate<A>): Predicate<A> => {
  return a => !predicate(a);
};

export function or<A, B1 extends A, B2 extends A>(
  p1: Refinement<A, B1>,
  p2: Refinement<A, B2>
): Refinement<A, B1 | B2>;
export function or<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A>;
export function or<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A> {
  return a => p1(a) || p2(a);
}

export function and<A, B extends A, C extends B>(
  p1: Refinement<A, B>,
  p2: Refinement<B, C>
): Refinement<A, C>;
export function and<A, B extends A>(
  p1: Refinement<A, B>,
  p2: Predicate<B>
): Refinement<A, B>;
export function and<A, B extends A>(
  p1: Predicate<A>,
  p2: Refinement<A, B>
): Refinement<A, B>;
export function and<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A>;
export function and<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A> {
  return a => p1(a) && p2(a);
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
