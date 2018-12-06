import { SExpression, printExpression } from './interpreter'
import { Cons, cdr, isCons, car, isProperList, cons,
  map, unsafeLength, isList, fromArray, listToIterable } from './Cons'
import mem from 'mem'

export const symExpr: <T extends string>(value: T) => symbol & { description: T } =
  mem((value: string) => Symbol(value) as any)
export const nil = symExpr('nil')
export const t = symExpr('t')
export type Nil = typeof nil
export type T = typeof t
export const isNil = (e: SExpression): e is Nil => e === nil
export const isT = (e: SExpression): e is T => e === t

export type SymbolTableFn = {
  kind: 'function'
  value: ((params: Cons) => SExpression)
}

export type SymbolTableSpecialForm = {
  kind: 'special'
  value: ((params: Cons) => SExpression)
}

export type SymbolTableSExpr = {
  kind: 'symbol'
  value: SExpression
}

export type SymbolTableEntry = SymbolTableFn | SymbolTableSExpr | SymbolTableSpecialForm

export type SymbolTable = Map<symbol, SymbolTableEntry>

export const getSymbol = (table: SymbolTable) => (name: symbol) => {
  const existing = table.get(name)
  if (typeof existing === 'undefined')
    throw new ReferenceError(`Symbol ${printExpression(name)} has no value`)
  return existing
}

export const evalFn = (table: SymbolTable) => (arg: SExpression): SExpression => {
  // TODO: find out how we represent function values
  if (typeof arg === 'symbol') {
    const sym = getSymbol(table)(arg).value
    if (typeof sym === 'function') throw new Error('Funtion values are Unimplemented')
    return sym
  }
  if (!isCons(arg)) return arg

  // attempt to execute the function indicated by car of arg
  // arg is a proper list because we don't allow 
  const fnSymRef = car(arg)
  if (typeof fnSymRef !== 'symbol')
    throw new TypeError(`${printExpression(fnSymRef)} is not a function name; try using a symbol instead`)
  const tableEntry = getSymbol(table)(fnSymRef)
  if (tableEntry.kind === 'special') {
    // if it's a special form, pass the argument list in unevaluated
    return tableEntry.value(arg)
  }
  if (tableEntry.kind === 'function') {
    const passedParams = cdr(arg)
    // TODO: remove recursion here
    // eval in clisp doesn't seem to evaluate the last item of a cons
    // try: (eval (+ . some_unvalued_sym))
    // we won't do that here because its a weird feature that I don't understand
    const mapped =
      isCons(passedParams)
      ? map(evalFn(table))(passedParams)
      : evalFn(table)(passedParams)
      return tableEntry.value(cons(fnSymRef, mapped))
  }
  throw new TypeError(`symbol ${printExpression(fnSymRef)} with value ${printExpression(tableEntry.value)} is not a function`)
}

function validate(fncall: Cons, arglen: number | [number, number], proper?: true): Cons
function validate(fncall: Cons, arglen: number | [number, number], proper: false): SExpression
function validate(fncall: Cons, arglen: number | [number, number], proper?: boolean): SExpression
function validate(fncall: Cons, arglen: number | [number, number], proper = true): SExpression {
  const { car: fnNameSym, cdr: args } = fncall
  const [min, max] = typeof arglen === 'number' ? [arglen, arglen] : arglen

  if (typeof fnNameSym !== 'symbol')
    throw new Error(`Don't know how we got here, but function call name ${fnNameSym} is not a symbol`)
  if (proper && !isProperList(args))
    throw new TypeError(`argument list given to ${fnNameSym.description} is dotted: ${printExpression(fncall)}`)
  if (!isList(args)) return args

  // TODO: this can loop infinitely if args has a cycle
  const len = unsafeLength(args)
  if (len > max) {
    throw new TypeError(`too many arguments given to ${fnNameSym.description}: ${printExpression(fncall)}`)
  } else if (len < min) {
    throw new TypeError(`too few arguments given to ${fnNameSym.description}: ${printExpression(fncall)}`)
  }

  return args
}

export const symboltable: SymbolTable = new Map<symbol, SymbolTableEntry>([
  [t, { kind: 'symbol', value: t }],
  [nil, { kind: 'symbol', value: nil }],
  [symExpr('eval'), {
    kind: 'function',
    value: (fncall: Cons): SExpression => {
      const { car: arg } = validate(fncall, 1)
      // if arguments is a cons, try to execute, with the first elem of the list as the function
      // and the rest of the list as the parameters
      // we pass params directly to the function. functions can ignore the first car,
      // since it will just be its own symbol
      // some functions fail if called as dotted, some ignore the last param
      // (+ . 1) => 0 vs (print . "hello") => error
      // this should be handled by the called function
      // (eval . 1) => { car: eval, cons: 1 }

      return evalFn(symboltable)(arg)
    }
  }],
  [symExpr('quote'), {
    kind: 'special',
    value: (fncall: Cons): SExpression => {
      const { car: arg } = validate(fncall, 1)
      // return the argument unevaluated
      return arg
    }
  }],
  [symExpr('print'), {
    kind: 'function',
    value: (fncall: Cons): SExpression => {
      const { car: arg } = validate(fncall, 1)
      console.log(printExpression(arg))
      return arg
    }
  }],
  [symExpr('cons'), {
    kind: 'function',
    value: (fncall: Cons): SExpression => {
      const { car: first, cdr: second } = validate(fncall, 2)
      return cons(first, car(second as Cons))
    }
  }],
  [symExpr('car'), {
    kind: 'function',
    value: (fncall: Cons): SExpression => {
      const { car: arg } = validate(fncall, 1)
      if (!isList(arg)) {
        throw new TypeError(`${printExpression(arg)} is not a list`)
      }
      return car(arg)
    }
  }],
  [symExpr('cdr'), {
    kind: 'function',
    value: (fncall: Cons): SExpression => {
      const { car: arg } = validate(fncall, 1)
      if (!isList(arg)) {
        throw new TypeError(`${printExpression(arg)} is not a list`)
      }
      return cdr(arg)
    }
  }],
  [symExpr('list'), {
    kind: 'function',
    value: (fncall: Cons): SExpression => {
      const { cdr: args } = fncall
      if (!isCons(args)) return nil
      return fromArray([...listToIterable(args, false)])
    }
  }],
])
