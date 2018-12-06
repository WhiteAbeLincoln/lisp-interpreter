import { SExpression, printExpression } from './interpreter'
import { Cons, cdr, isCons, car, isProperList, cons,
  map, unsafeLength, isList, fromArray, listToIterable, ConsG } from './Cons'
import mem from 'mem'
import { filterMap, mapFilter, truthy } from './util';

export const symExpr: <T extends string>(value: T) => symbol & { description: T } =
  mem((value: string) => Symbol(value) as any)
export const nil = symExpr('nil')
export const t = symExpr('t')
export type Nil = typeof nil
export type T = typeof t
export const isNil = (e: SExpression): e is Nil => e === nil
export const isT = (e: SExpression): e is T => e === t

export type LambdaValue = {
  kind: 'lambda'
  (params: Cons): SExpression
}

export const isLambdaValue = (x: any): x is LambdaValue =>
  typeof x === 'function' && (x as LambdaValue).kind === 'lambda'

export type SymbolTableFn = {
  kind: 'lambda'
  value: ((table: SymbolTable) => LambdaValue)
}

export type SpecialFormValue = {
  kind: 'special'
  (params: Cons): SExpression
}

export type SymbolTableSpecialForm = {
  kind: 'special'
  value: ((table: SymbolTable) => SpecialFormValue)
}

export type SymbolTableSExpr = {
  kind: 'symbol'
  value: SExpression
}

export type SymbolTableEntry = SymbolTableFn | SymbolTableSExpr | SymbolTableSpecialForm

export type SymbolTable = { parent: SymbolTable | null, table: Map<symbol, SymbolTableEntry> }

export const getSymbol = (table: SymbolTable) => (name: symbol) => {
  let tablePointer: SymbolTable['parent'] = table
  while (tablePointer !== null) {
    const existing = tablePointer.table.get(name)
    if (typeof existing !== 'undefined')
      return existing
    else
      tablePointer = table.parent
  }
  throw new ReferenceError(`Symbol ${printExpression(name)} has no value`)
}

const pushTable = (table: SymbolTable): SymbolTable => {
  return { parent: table, table: new Map() }
}

const executeFn = (table: SymbolTable) => (fn: LambdaValue | SpecialFormValue, arg: Cons, fnSymRef: symbol | LambdaValue | SpecialFormValue) => {
  if (fn.kind === 'special') {
    // if it's a special form, pass the argument list in unevaluated
    return fn(arg)
  }

  if (fn.kind === 'lambda') {
    const passedParams = cdr(arg)
    // TODO: remove recursion here
    // eval in clisp doesn't seem to evaluate the last item of a cons
    // try: (eval (+ . some_unvalued_sym))
    // we won't do that here because its a weird feature that I don't understand
    const mapped =
      isCons(passedParams)
      ? map(evalFn(table))(passedParams)
      : evalFn(table)(passedParams)
      return fn(cons(fnSymRef, mapped))
  }

  throw new TypeError(`symbol ${printExpression(fnSymRef)} with value ${printExpression(fn)} is not a function`)
}

const evaluateSymbol = (table: SymbolTable) => (arg: symbol) => {
  const sym = getSymbol(table)(arg).value
  if (typeof sym === 'function') {
    if (isLambdaValue(sym)) {
      return sym
    }
    
    return (sym as (table: SymbolTable) => LambdaValue | SpecialFormValue)(table)
  }
  return sym

}

const tryExecuteFunction = (table: SymbolTable) => (arg: Cons) => {
  let fnSymRef = car(arg)
  while (typeof fnSymRef !== 'function') {
    fnSymRef
      = typeof fnSymRef === 'symbol' ? evaluateSymbol(table)(fnSymRef)
      : isCons(fnSymRef) ? tryExecuteFunction(table)(fnSymRef) // evalFn(table)(fnSymRef)
      : fnSymRef

    if (typeof fnSymRef === 'string' || typeof fnSymRef === 'number')
      throw new TypeError(`${printExpression(fnSymRef)} is not a function name; try using a symbol instead`)
  }

  return executeFn(table)(fnSymRef, arg, fnSymRef)
}

export const evalFn = (table: SymbolTable) => (arg: SExpression): SExpression => {
  if (typeof arg === 'symbol') {
    return evaluateSymbol(table)(arg)
  }

  if (!isCons(arg)) return arg

  return tryExecuteFunction(table)(arg)

  // attempt to execute the function indicated by car of arg
  // arg is a proper list because we don't allow 


  // if (typeof fnSymRef !== 'symbol' && typeof fnSymRef !== 'function')

  // const fn =
  //   typeof fnSymRef === 'function'
  //     ? fnSymRef
  //     : ((sym: SymbolTableEntry) => {
  //       if (sym.kind === 'symbol')
  //         throw new TypeError(`symbol ${printExpression(fnSymRef)} with value ${printExpression(sym.value)} is not a function`)
  //       return sym.value(table)
  //     })(getSymbol(table)(fnSymRef))

  // return executeFn(table)(fn, arg, fnSymRef)
}

function validate(fncall: Cons, arglen: 5, proper?: true): ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, Nil>>>>>
function validate(fncall: Cons, arglen: 4, proper?: true): ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, Nil>>>>
function validate(fncall: Cons, arglen: 3, proper?: true): ConsG<SExpression, ConsG<SExpression, ConsG<SExpression, Nil>>>
function validate(fncall: Cons, arglen: 2, proper?: true): ConsG<SExpression, ConsG<SExpression, Nil>>
function validate(fncall: Cons, arglen: 1, proper?: true): ConsG<SExpression, Nil>
function validate(fncall: Cons, arglen: number | [number, number], proper?: true): Cons
function validate(fncall: Cons, arglen: number | [number, number], proper: false): SExpression
function validate(fncall: Cons, arglen: number | [number, number], proper?: boolean): SExpression
function validate(fncall: Cons, arglen: number | [number, number], proper = true): SExpression {
  const { car: fnNameSym, cdr: args } = fncall
  const [min, max] = typeof arglen === 'number' ? [arglen, arglen] : arglen

  if (typeof fnNameSym !== 'symbol' && typeof fnNameSym !== 'function')
    throw new Error(`Don't know how we got here, but function call name ${fnNameSym} is not a symbol or function`)
  const name = (fnNameSym as symbol).description || (fnNameSym as LambdaValue).kind
  if (proper && !isProperList(args))
    throw new TypeError(`argument list given to ${name} is dotted: ${printExpression(fncall)}`)
  if (!isList(args)) return args

  // TODO: this can loop infinitely if args has a cycle
  const len = unsafeLength(args)
  if (len > max) {
    throw new TypeError(`too many arguments given to ${name}: ${printExpression(fncall)}`)
  } else if (len < min) {
    throw new TypeError(`too few arguments given to ${name}: ${printExpression(fncall)}`)
  }

  return args
}

const argumentlist = (arglist: SExpression): Array<{ sym: symbol, variadic?: true }> => {
  if (arglist === nil) return []
  if (typeof arglist === 'symbol') return [{ sym: arglist, variadic: true }]
  if (!isCons(arglist)) throw new TypeError(`${printExpression(arglist)} is not an argument list`) 
  //  filterM
  const arr: Array<{ sym: symbol, variadic?: true }> = []
  const list = [...listToIterable(arglist)]
  for (let i = 0; i < list.length; ++i) {
    const v = list[i]

    if (typeof v !== 'symbol')
      throw new TypeError(`${printExpression(v)} is not a symbol and so cannot be in an argument list`)
    if (arr.find(x => x.sym === v))
      throw new SyntaxError(`Duplicate argument name ${printExpression(v)}`)

    if (i === list.length - 1) {
      if (v !== nil) {
        arr.push({ sym: v, variadic: true as true })
      } else {
        continue
      }
    } else {
      arr.push({ sym: v })
    }
  }

  return arr
}

const numParams = (args: ReturnType<typeof argumentlist>): [number, number] => {
  if (args.length === 0) return [0, 0]
  if (args.length === 1 && args[0].variadic) return [0, Infinity]
  const hasVariadic = args.some(a => !!a.variadic)
  if (hasVariadic) return [args.length - 1, Infinity]
  return [args.length, args.length]
}

const bindParams = (table: SymbolTable, args: SExpression, arglist: ReturnType<typeof argumentlist>): SymbolTable => {
  let pointer = args
  for (const argrule of arglist) {
    const sym = argrule.sym
    if (table.table.has(sym)) {
      throw new ReferenceError(`cannot rebind symbol ${printExpression(sym)}`)
    }
    if (argrule.variadic) {
      table.table.set(sym, { kind: 'symbol', value: pointer })
      continue
    }

    // this doesn't look right because pointer will never terminate
    // however, pointer should be a list, and should have the same length
    // as arglist or arglist is variadic
    const value = isList(pointer) ? car(pointer) : pointer
    table.table.set(sym, { kind: 'symbol', value })
    pointer = isList(pointer) ? cdr(pointer) : pointer
  }
  return table
}

const createLambda = (fn: (fncall: Cons) => SExpression): LambdaValue => {
  (fn as LambdaValue).kind = 'lambda'
  return fn as LambdaValue
}

const createSpecial = (fn: (fncall: Cons) => SExpression): SpecialFormValue => {
  (fn as SpecialFormValue).kind = 'special'
  return fn as SpecialFormValue
}

const symboltableTable: SymbolTable['table'] = new Map<symbol, SymbolTableEntry>([
  [t, { kind: 'symbol', value: t }],
  [nil, { kind: 'symbol', value: nil }],
  [symExpr('eval'), {
    kind: 'lambda',
    value: table => createLambda(fncall => {
      const { car: arg } = validate(fncall, 1)
      // if arguments is a cons, try to execute, with the first elem of the list as the function
      // and the rest of the list as the parameters
      // we pass params directly to the function. functions can ignore the first car,
      // since it will just be its own symbol
      // some functions fail if called as dotted, some ignore the last param
      // (+ . 1) => 0 vs (print . "hello") => error
      // this should be handled by the called function
      // (eval . 1) => { car: eval, cons: 1 }

      return evalFn(table)(arg)
    })
  }],
  [symExpr('quote'), {
    kind: 'special',
    value: _table => createSpecial(fncall => {
      const { car: arg } = validate(fncall, 1)
      // return the argument unevaluated
      return arg
    })
  }],
  [symExpr('print'), {
    kind: 'lambda',
    value: _table => createLambda(fncall => {
      const { car: arg } = validate(fncall, 1)
      console.log(printExpression(arg))
      return arg
    })
  }],
  [symExpr('cons'), {
    kind: 'lambda',
    value: _table => createLambda(fncall => {
      // it would be nice if we could get this type by default
      // maybe overload the validate call
      const { car: first, cdr: second } = validate(fncall, 2)
      return cons(first, car(second))
    })
  }],
  [symExpr('car'), {
    kind: 'lambda',
    value: _table => createLambda(fncall => {
      const { car: arg } = validate(fncall, 1)
      if (!isList(arg)) {
        throw new TypeError(`${printExpression(arg)} is not a list`)
      }
      return car(arg)
    })
  }],
  [symExpr('cdr'), {
    kind: 'lambda',
    value: _table => createLambda(fncall => {
      const { car: arg } = validate(fncall, 1)
      if (!isList(arg)) {
        throw new TypeError(`${printExpression(arg)} is not a list`)
      }
      return cdr(arg)
    })
  }],
  [symExpr('list'), {
    kind: 'lambda',
    value: _table => createLambda(fncall => {
      const { cdr: args } = fncall
      if (!isCons(args)) return nil
      return fromArray([...listToIterable(args, false)])
    })
  }],
  [symExpr('lambda'), {
    kind: 'special',
    value: table => createSpecial(fncall => {
      /* a lambda is composed of 2 parts
        1. the argument list:
          An argument list is either 
          a. a naked symbol - this indicates a variadic function accepting any number of parameters
            that will be bound to the symbol
          b. a proper list of symbols - this indicates a function with arity equal to the list's length
            every parameter will be bound to a symbol in the list in order
          c. an improper list - the final cdr will be variadic while all the previous cons will be bound in order
        2. The lambda body - evaluated when the lambda is called. has access to the parent lexical scope
          and local bound variables from the parameter list
      */
      const { car: arglist, cdr: { car: body } } = validate(fncall, 2)
      const lambdalist = argumentlist(arglist)
      const num = numParams(lambdalist)
      // should return a function
      return createLambda(params => {
        const args = validate(params, num)
        const newtable = bindParams(pushTable(table), args, lambdalist)

        // return nil
        return evalFn(newtable)(body)
      })
    })
  }],
  [symExpr('define'), {
    kind: 'special',
    value: table => createSpecial(fncall => {
      const { car: name, cdr: value } = validate(fncall, 2)
      if (typeof name !== 'symbol')
        throw new TypeError(`${printExpression(name)} is not a symbol and so cannot be used to bind a name`)
      bindParams(table, value, [{ sym: name }])
      return name
    })
  }],
  [symExpr('string-append'), {
    kind: 'lambda',
    value: _table => createLambda(fncall => {
      const { car: s1, cdr: { car: s2 } } = validate(fncall, 2)
      if (typeof s1 !== 'string' || typeof s2 !== 'string')
        throw new TypeError(`Cannot append ${printExpression(s1)} and ${printExpression(s2)} as they are not both strings`)
      return s1 + s2
    })
  }]
])

export const symboltable = { parent: null, table: symboltableTable }