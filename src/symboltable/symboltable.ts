import {
  isProperList, unsafeLength, isList, ConsG,
  isCons, reduce as reduceCons, cons, reduce1 as reduce1Cons, listToIterable,
  car, cdr, fromArray, append, map as mapCons
} from '../Cons'
import { printExpression } from '../print'
import { t, f } from './common-symbols'
import { SExpression, Cons, BootstrapFn, isLambdaFn, isBoostrapFn, LambdaFn, isProcedure, isMacro, arity, EmptyList } from '../SExpression'
import { evalFn, macroExpand, applyFn, applyFn1 } from '../eval'
import { symExpr, add, div, sub, mult, gt, lt, lte, gte, eq, tuple, isInterned } from '../util'
import { reduce as reduceI } from '../iterable'
import { Predicate } from '../match/types'
import { readString } from '../parser'
import { Fn } from '../match/functional'

export type SymbolTable = { parent: SymbolTable | null, table: Map<symbol, SExpression> }

function* iterateTables(table: SymbolTable) {
  let tablePointer: SymbolTable['parent'] = table
  while (tablePointer !== null) {
    yield tablePointer.table
    tablePointer = tablePointer.parent
  }
}

export function getSymbol(env: SymbolTable, name: symbol, crash?: true): SExpression
export function getSymbol(env: SymbolTable, name: symbol, crash: false): SExpression | undefined
export function getSymbol(env: SymbolTable, name: symbol, crash: boolean): SExpression | undefined
export function getSymbol(env: SymbolTable, name: symbol, crash = true): SExpression | undefined {
  for (const table of iterateTables(env)) {
    const existing = table.get(name)
    if (typeof existing !== 'undefined')
      return existing
  }
  if (crash)
    throw new ReferenceError(`Symbol ${printExpression(name)} has no value`)
  return undefined
}

export const pushTable = (table: SymbolTable): SymbolTable => {
  return { parent: table, table: new Map() }
}

export const setValue = (env: SymbolTable, name: symbol, value: SExpression) => {
  if (env.table.has(name)) {
    throw new ReferenceError(`cannot rebind symbol ${printExpression(name)}`)
  }

  env.table.set(name, value)

  return name
}

type CPair1<
  T1 extends SExpression = SExpression,
> = ConsG<T1, SExpression>
type CPair2<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
> = ConsG<T1, CPair1<T2>>
type CPair3<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
> = ConsG<T1, CPair2<T2, T3>>
type CPair4<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
  T4 extends SExpression = SExpression,
> = ConsG<T1, CPair3<T2, T3, T4>>
type CPair5<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
  T4 extends SExpression = SExpression,
  T5 extends SExpression = SExpression,
> = ConsG<T1, CPair4<T2, T3, T4, T5>>

type CTuple1<T extends SExpression = SExpression> = ConsG<T, EmptyList>
type CTuple2<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
> = ConsG<T1, CTuple1<T2>>
type CTuple3<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
> = ConsG<T1, CTuple2<T2, T3>>
type CTuple4<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
  T4 extends SExpression = SExpression,
> = ConsG<T1, CTuple3<T2, T3, T4>>
type CTuple5<
  T1 extends SExpression = SExpression,
  T2 extends SExpression = SExpression,
  T3 extends SExpression = SExpression,
  T4 extends SExpression = SExpression,
  T5 extends SExpression = SExpression,
> = ConsG<T1, CTuple4<T2, T3, T4, T5>>

export function validate(fncall: Cons, arglen: [5, number], proper?: boolean): CPair5
export function validate(fncall: Cons, arglen: [4, number], proper?: boolean): CPair4
export function validate(fncall: Cons, arglen: [3, number], proper?: boolean): CPair3
export function validate(fncall: Cons, arglen: [2, number], proper?: boolean): CPair2
export function validate(fncall: Cons, arglen: [1, number], proper?: boolean): CPair1
export function validate(fncall: Cons, arglen: 5, proper?: true): CTuple5
export function validate(fncall: Cons, arglen: 4, proper?: true): CTuple4
export function validate(fncall: Cons, arglen: 3, proper?: true): CTuple3
export function validate(fncall: Cons, arglen: 2, proper?: true): CTuple2
export function validate(fncall: Cons, arglen: 1, proper?: true): CTuple1
export function validate(fncall: Cons, arglen: number | [number, number], proper?: true): Cons
export function validate(fncall: Cons, arglen: number | [number, number], proper?: boolean): SExpression
export function validate(fncall: Cons, arglen: number | [number, number], proper = true): SExpression {
  const { car: fnNameSym, cdr: args } = fncall
  const [min] = typeof arglen === 'number' ? [arglen, arglen] : arglen

  if (typeof fnNameSym !== 'symbol' && !isLambdaFn(fnNameSym) && !isBoostrapFn(fnNameSym))
    throw new Error(`Don't know how we got here, but function call name ${fnNameSym} is not a symbol or function`)
  const name = (fnNameSym as symbol).description || (fnNameSym as LambdaFn).name || '[lambda]'
  if (proper && !isProperList(args))
    throw new TypeError(`argument list given to ${name} is dotted: ${printExpression(fncall)}`)
  if (!isList(args)) {
    if (!Array.isArray(arglen)) return args
    throw new TypeError(`argument list given to ${name} is dotted: ${printExpression(fncall)}`)
  }

  // TODO: this can loop infinitely if args has a cycle
  const len = unsafeLength(args)
  if (len < min) {
    throw new TypeError(`too few arguments given to ${name}: ${printExpression(fncall)}`)
  }

  return args
}

const accumulate = <T extends SExpression>(op: Fn<[T, T], T>, identity: T, pred: (v: SExpression) => v is T) =>
  (fncall: Cons, _: SymbolTable, n: [number, number]): SExpression => {
    const args = validate(fncall, n, false)
    return reduceCons(op, identity, pred)(args)
  }

const accumulate1 = <T extends SExpression>(op: Fn<[T, T], T>, identity: T, pred: (v: SExpression) => v is T) =>
  (fncall: Cons, _: SymbolTable, n: [number, number]): SExpression => {
    const { car: first, cdr: rest } = validate(fncall, n as [1, number], false)
    if (!pred(first))
      throw new TypeError(`accumulate1: ${printExpression(first)} is not the correct type`)
    if (!isCons(rest)) return op(identity, first)
    return reduce1Cons(op, pred)(cons(first, rest))
  }

const isNum = (v: SExpression): v is number => typeof v === 'number'

const compare = (op: Fn<[number, number], boolean>) =>
  (fncall: Cons, _: SymbolTable, n: [number, number]): SExpression => {
    const args = validate(fncall, n, false)

    const argsArr = [...listToIterable(args, false)]
    for (let i = 1; i < argsArr.length; i++) {
      const first = argsArr[i - 1]
      const second = argsArr[i]
      if (typeof first !== 'number')
        throw new TypeError(`${printExpression(first)} is not a number`)
      if (typeof second !== 'number')
        throw new TypeError(`${printExpression(second)} is not a number`)

      if (op(first, second)) continue
      else return f
    }
    return t
  }

const createBoostrap = (
  body: BootstrapFn['body'],
  name: string,
  numParams: [number, number] | number,
  curry?: boolean,
): BootstrapFn => ({
  kind: 'boostrap',
  name,
  body,
  numParams:
    typeof numParams === 'number'
      ? [numParams, numParams]
      :  numParams,
  curried: curry ? [] : false,
})

const createSExprEntry =
  <T extends string>(symbol: symbol | T, value: SExpression): [symbol, SExpression] =>
    [typeof symbol === 'string' ? symExpr(symbol) : symbol, value]

function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: 5 | [5, number],
  body: (args: CPair5, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: true,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: 4 | [4, number],
  body: (args: CPair4, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: true,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: 3 | [3, number],
  body: (args: CPair3, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: true,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: 2 | [2, number],
  body: (args: CPair2, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: true,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: 1 | [1, number],
  body: (args: CPair1, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: true,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: Parameters<typeof createBoostrap>[2],
  body: (args: Cons, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry: boolean,
  doValidate: false,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: Parameters<typeof createBoostrap>[2],
  body: (args: SExpression, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate?: boolean,
): ReturnType<typeof createSExprEntry>
function createBoostrapEntry<T extends string>(
  symbol: T | symbol,
  numParams: Parameters<typeof createBoostrap>[2],
  body: (args: any, env: SymbolTable, numParams: [number, number]) => SExpression,
  curry?: boolean,
  doValidate = true,
): ReturnType<typeof createSExprEntry> {
  const name = typeof symbol === 'string' ? symbol : symbol.description
  const realBody
    = !doValidate
    ? body
    : (fncall: Cons, env: SymbolTable, numParams: [number, number]) =>
      body(validate(fncall, numParams), env, numParams)
  return createSExprEntry(symbol, createBoostrap(
    realBody, name, numParams, curry
  ))
}

const createPred = <T extends string>(name: T | symbol, pred: Predicate<SExpression>) =>
  createBoostrapEntry(name, 1, args => {
    const { car } = args as Cons
    return pred(car) ? t : f
  })

const symboltableTable: SymbolTable['table'] = new Map<symbol, SExpression>([
  createSExprEntry(t, t),
  createSExprEntry(f, f),
  createSExprEntry('Infinity', Infinity),
  createBoostrapEntry('eval', 1, args => {
    const { car: arg } = args as Cons
    return evalFn(symboltable, arg)
  }),
  createBoostrapEntry('+', [0, Infinity], accumulate(add, 0, isNum), false, false),
  createBoostrapEntry('-', [1, Infinity], accumulate1(sub, 0, isNum), false, false),
  createBoostrapEntry('*', [0, Infinity], accumulate(mult, 1, isNum), false, false),
  createBoostrapEntry('/', [1, Infinity], accumulate1(div, 1, isNum), false, false),
  createBoostrapEntry('>', [1, Infinity], compare(gt), false, false),
  createBoostrapEntry('<', [1, Infinity], compare(lt), false, false),
  createBoostrapEntry('<=', [1, Infinity], compare(lte), false, false),
  createBoostrapEntry('>=', [1, Infinity], compare(gte), false, false),
  createBoostrapEntry('=', [1, Infinity], compare(eq), false, false),
  createBoostrapEntry('print', 1, args => {
    const { car: arg } = args
    console.log(printExpression(arg))
    return arg
  }),
  // createBoostrapEntry('cons', 2, args => {
  //   const { car: first, cdr: { car: second } } = args
  //   return cons(first, second)
  // }, true),
  createBoostrapEntry('car', 1, args => {
    const { car: arg } = args
    if (!isList(arg))
      throw new TypeError(`${printExpression(arg)} is not a list`)
    return car(arg)
  }),
  createBoostrapEntry('cdr', 1, args => {
    const { car: arg } = args
    if (!isList(arg))
      throw new TypeError(`${printExpression(arg)} is not a list`)
    return cdr(arg)
  }),
  createBoostrapEntry('list*', [2, Infinity], args => {
    if (!isCons(args))
      throw new TypeError(`list*: Expecting cons, but recieved ${printExpression(args)}`)
    return fromArray([...listToIterable(args, false)], { notProper: true })
  }),
  createBoostrapEntry('append', [0, Infinity], args => {
    return append(listToIterable(args, false))
  }),
  createBoostrapEntry('string-append', [1, Infinity],
    accumulate1((a: string, b: string) => a + b, '', (v): v is string => typeof v === 'string'), false),
  createBoostrapEntry('eq?', 2, args => {
    // Object reference equality
    const { car: o1, cdr: { car: o2 } } = args
    return o1 === o2 ? t : f
  }, true),
  createPred('pair?', isCons),
  createPred('list?', isProperList),
  createPred('number?', v => typeof v === 'number'),
  createPred('integer?', v => typeof v === 'number' && Number.isInteger(v)),
  createPred('natural?', v => typeof v === 'number' && Number.isInteger(v) && v >= 0),
  createPred('string?', v => typeof v === 'string'),
  createPred('procedure?', isProcedure),
  createPred('lambda?', isLambdaFn),
  createPred('macro?', isMacro),
  createPred('symbol?', v => typeof v === 'symbol'),
  createPred('symbol-interned?', v => {
    if (typeof v !== 'symbol')
      throw new TypeError(`Expected symbol?, given ${printExpression(v)}`)
    return isInterned(v)
  }),
  createPred('nan?', v => {
    if (typeof v !== 'number')
      throw new TypeError(`Expected number?, given ${printExpression(v)}`)
    return Number.isNaN(v)
  }),
  createPred('infinite?', v => {
    if (typeof v !== 'number')
      throw new TypeError(`Expected number?, given ${printExpression(v)}`)
    return !Number.isFinite(v)
  }),
  createBoostrapEntry('number->string', [1, 2], args => {
    const { car: num, cdr } = args
    if (cdr !== f && !isList(cdr))
      throw new TypeError(`number->string: Expected the options to be a hash-map`)

    if (typeof num !== 'number')
      throw new TypeError(`number->string: Expected number, but recieved ${printExpression(num)}`)

    // TODO: replace with a proper hash-map implementation
    const optionsIter = cdr === f ? [] : listToIterable(car(cdr as Cons), false)
    console.log(cdr)
    type Options = { mode: 'radix' | 'fixed' | 'prec' | 'exp', param: number }
    const symbols = tuple(symExpr('radix'), symExpr('fixed'), symExpr('prec'), symExpr('exp'))

    const { mode, param } = reduceI(optionsIter, (acc, curr) => {
      console.log('Acc', acc, 'Curr', curr)
      if (!isCons(curr))
        throw new TypeError(`number->string: Expected the options to be a hash-map`)
      const { car: key, cdr: value } = curr
      if (typeof key !== 'symbol' || !(symbols as symbol[]).includes(key))
        return acc
      if (typeof value !== 'number')
        throw new TypeError(`number->string: value for option ${printExpression(key)} must be a number`)
      const mode: Options['mode'] = (key as (typeof symbols)[number]).description
      if (mode === 'radix' && (value < 2 || value > 36))
        throw new RangeError(`number->string: radix argument must be between 2 and 36`)
      else if (mode === 'prec' && (value < 1 || value > 100))
        throw new RangeError(`number->string: prec argument must be between 1 and 100`)
      else if ((mode === 'fixed' || mode === 'exp') && (value < 0 || value > 100))
        throw new RangeError(`number->string: ${mode} argument must be between 0 and 100`)

      acc.mode = mode
      acc.param = value
      return acc
    }, { mode: 'radix', param: 10 } as Options)

    return mode === 'radix'
      ? num.toString(param)
      : mode === 'exp' ? num.toExponential(param)
      : mode === 'fixed' ? num.toFixed(param)
      : mode === 'prec' ? num.toPrecision(param)
      : mode
  }),
  createBoostrapEntry('string->symbol', 1, args => {
    const { car: arg } = args
    if (typeof arg !== 'string')
      throw new TypeError(`${printExpression(arg)} is not a string`)
    return symExpr(arg)
  }),
  createBoostrapEntry('string->uninterned-symbol', 1, args => {
    const { car: arg } = args
    if (typeof arg !== 'string')
      throw new TypeError(`${printExpression(arg)} is not a string`)
    return Symbol(arg)
  }),
  createBoostrapEntry('symbol->string', 1, args => {
    const { car: arg } = args
    if (typeof arg !== 'symbol')
      throw new TypeError(`Expected symbol?, given ${printExpression(arg)}`)
    return arg.description || '<Unknown Symbol>'
  }),
  createBoostrapEntry('read/string', 1, args => {
    const { car: arg } = args
    if (typeof arg !== 'string')
      throw new TypeError(`Expected string?, given ${printExpression(arg)}`)
    const arr = readString(arg)
    return arr.length === 1 ? arr[0] : fromArray(arr)
  }),
  createBoostrapEntry('macroexpand', 1, (args, env) => {
    const { car: arg } = args
    return macroExpand(arg, env)
  }),
  createBoostrapEntry('map', 2, (args, env) => {
    const { car: fn, cdr: { car: list } } = args

    if (!isProcedure(fn))
      throw new Error('map: expects a function value')
    if (!isProperList(list))
      throw new Error('map: expects a proper list')
    const [minExpected] = arity(fn)
    if (minExpected > 1)
      throw new Error('map: function arity is incorrect - must accept 1 or less parameters')

    const jsFn = applyFn(env)(fn)

    return mapCons(jsFn)(list)
  }, true),
  createBoostrapEntry('reduce', 3, (args, env) => {
    const { car: fn, cdr: { car: init, cdr: { car: list }}} = args

    if (!isProcedure(fn))
      throw new Error('reduce: expects a function value')
    if (!isProperList(list))
      throw new Error('reduce: expects a proper list')
    const [minExpected] = arity(fn)
    if (minExpected > 2)
      throw new Error('reduce: function arity is incorrect - must accept 2 or less parameters')

    const jsFn = applyFn(env)(fn)

    return reduceCons(jsFn, init)(list)
  }, true),
  createBoostrapEntry('procedure-arity', 1, args => {
    const { car: fn } = args
    if (!isProcedure(fn))
      throw new Error('procedure-arity: expected function')
    return fromArray(arity(fn))
  }),
  createBoostrapEntry('procedure-orig-arity', 1, args => {
    const { car: fn } = args
    if (!isProcedure(fn))
      throw new Error('procedure-orig-arity: expected function')
    return fromArray(fn.numParams)
  }),
  createBoostrapEntry('procedure-name', 1, args => {
    const { car: fn } = args
    if (!isProcedure(fn))
      throw new Error('procedure-name: expected function')
    return fn.name || ''
  }),
  createBoostrapEntry('rename-procedure', 2, args => {
    const { car: name, cdr: { car: fn } } = args

    if (typeof name !== 'string')
      throw new Error('procedure-rename: expected string')
    if (!isProcedure(fn))
      throw new Error('procedure-rename: expected function')

    return { ...fn, name }
  }, true),
  createBoostrapEntry('curry', 1, args => {
    const { car: fn } = args
    if (!isProcedure(fn))
      throw new Error('curry: expected function')
    return { ...fn, curried: fn.curried || [] }
  }),
])

export const symboltable = { parent: null, table: symboltableTable }

export const rep = (str: string) =>
  readString(str).map(e => printExpression(evalFn(symboltable, e)))

// The standard library that can be defined using macros and the functions above in the symbol table

rep(`
  ;; sugar for defining a macro
  (define defmacro
      (macro (name params body)
        \`(define ,name (macro ,params ,body))))
  ;; sugar for defining a function
  (define defun
    (macro (name params body)
      \`(define ,name (lambda ,params ,body))))
  (defmacro defunC (name params body)
      \`(define ,name (curry (lambda ,params ,body))))

  ; combinators
  ; identity
  (defun I (x) x)
  (define identity I)
  ; const
  (defunC K (x y) x)
  (define const K)
  ; apply ($)
  (defunC A (f . a) (f . a))
  ; thrush
  (defunC T (a fn) (fn a))
  ; duplication (join)
  (defunC W (f x) ((f x) x))
  ; flip
  (defunC C (f x y) (f y x))
  (define flip C)
  ; compose
  (defunC B (f g x) (f (g x)))
  ; substitution (ap)
  (defunC S (x y z) ((x z) (y z)))
  ; psi (on)
  (defunC P (f g x y) ((f (g x)) (g y)))

  (defmacro if (pred true false)
      \`(cond (,pred ,true) (t ,false)))
  (defun not (bool) (if (eq? bool f) t f))

  (defmacro let (bindings body)
    \`((lambda ,(map car bindings) ,body)
        ,@(map (lambda (xs) (car (cdr xs))) bindings)))

  ; identity on lists
  (defun list xs xs)
  (defunC cons (a b) \`(,a . ,b))

  (defun last (xs)
    (if (list? xs)
      (if (empty? xs)
        (throw err)
        ; (flip const) :: (a b) -> b
        (reduce (flip const) '() xs))
      (throw err)))

  (define begin last)

  (defun empty? (xs) (eq? xs '()))

  (defunC nth (n xs)
    (cond ; or
      ; ((not (list? xs)) (throw "expected a list"))
      ; ((not (natural? xs)) (throw "expected a natural number"))
      (t (let (
            (nth^
              (lambda (n xs)
                (if (= n 0)
                  (car xs)
                  (if (empty? (cdr xs))
                    (throw "index out of bounds")
                    (nth^ (- n 1) (cdr xs)))))))
            (nth^ n xs)))))

  ; (defun length (xs)
  ;   (if
  ;     (list? xs)
  ;     (let
  ;       ((len (lambda (xs n)
  ;           (if
  ;             (eq? xs '())
  ;             n
  ;             (len (cdr xs) (+ n 1))))))
  ;       (len xs 0))
  ;     (throw err)))
  (defun length (xs)
    (if (list? xs) (reduce (add 1) 0 xs) (throw err)))

  (defunC add (x y) (+ x y))
`)
