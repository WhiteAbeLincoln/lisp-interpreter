import {
  SymbolTable, getSymbol,
  validate, setValue, pushTable,
} from './symboltable/symboltable'
import {
  isCons, car, listToIterable,
  cdr, map, isList, fromArray,
  cons, append
} from './Cons'
import { printExpression } from './print'
import {
  quoteSym, ifSym, nil, condSym,
  defineSym, lambdaSym, quasiquoteSym,
  unquoteSym, unquoteSpliceSym
} from './symboltable/common-symbols'
import { SExpression, Cons, LambdaParam, isLambdaFn, isBoostrapFn } from './SExpression'

const argumentlist = (arglist: SExpression): LambdaParam[] => {
  if (arglist === nil) return []
  if (typeof arglist === 'symbol') return [{ sym: arglist, variadic: true }]
  if (!isCons(arglist)) throw new TypeError(`${printExpression(arglist)} is not an argument list`)
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

/**
 * Determines if every symbol in a parent environment is shadowed by the child environment
 * @param env An environment
 */
const allShadowed = (env: SymbolTable) => {
  if (env.parent === null) return false
  for (const key of env.parent.table.keys()) {
    if (!env.table.has(key)) return false
  }

  return true
}

const bindParams = (table: SymbolTable, args: SExpression, arglist: LambdaParam[]): SymbolTable => {
  let pointer = args
  for (const argrule of arglist) {
    const sym = argrule.sym
    if (table.table.has(sym)) {
      throw new ReferenceError(`cannot rebind symbol ${printExpression(sym)}`)
    }
    if (argrule.variadic) {
      table.table.set(sym, pointer)
      continue
    }

    // this doesn't look right because pointer will never terminate
    // however, pointer should be a list, and should have the same length
    // as arglist or arglist is variadic
    const value = isList(pointer) ? car(pointer) : pointer
    table.table.set(sym, value)
    pointer = isList(pointer) ? cdr(pointer) : pointer
  }
  if (allShadowed(table)) {
    // if every entry of the parent is shadowed, there is no point in keeping a reference to it
    // should reduce the space complexity of deep recursion and the search time for unshadowed entries
    table.parent = table.parent && table.parent.parent
  }
  return table
}


function evalSExpression(env: SymbolTable, arg: Cons): Cons
function evalSExpression(env: SymbolTable, arg: SExpression): SExpression
function evalSExpression(env: SymbolTable, arg: SExpression): SExpression {
  if (typeof arg === 'symbol') {
    return getSymbol(env)(arg)
  }

  if (isCons(arg)) {
    return map(evalFn.bind(null, env))(arg)
  }

  return arg
}

const quasiquote = (ast: SExpression, env: SymbolTable): SExpression => {
  if (!isCons(ast)) return ast

  const astList = [...listToIterable(ast, false)]
  const [arg1, arg2] = astList

  if (arg1 === unquoteSym) {
    if (typeof arg2 === 'undefined')
      throw new Error(`unquote: takes exactly one argument`)
    return evalFn(env, arg2)
  }

  if (isCons(arg1)) {
    const [firstFirst, secondFirst] = listToIterable(arg1, false)
    if (firstFirst === unquoteSpliceSym) {
      if (typeof secondFirst === 'undefined')
        throw new Error(`unquote-splicing: takes exactly one argument`)
      return append([evalFn(env, secondFirst), quasiquote(fromArray(astList.slice(1)), env)])
    }
  }

  return cons(
      quasiquote(arg1, env)
    , quasiquote(fromArray(astList.slice(1)), env)
    )
}

export const evalFn = (env: SymbolTable, expr: SExpression): SExpression => {
  loop: while(true) {
    if (!isCons(expr)) {
      return evalSExpression(env, expr)
    }

    const fnRef = car(expr)
    // the fnRef must be either a symbol or a cons (which we evaluate to get a function value)
    if (!isCons(fnRef) && typeof fnRef !== 'symbol') {
      throw new TypeError(`${printExpression(fnRef)} is not a procedure`)
    }

    if (typeof fnRef === 'symbol') {
      // handle the special forms
      switch(fnRef) {
        case quoteSym: {
          const { car: arg } = validate(expr, 1)
          // return the argument unevaluated
          return arg
        }
        case unquoteSym:
        case unquoteSpliceSym: {
          throw new Error('unquote: not in quasiquote')
        }
        case quasiquoteSym: {
          const { car: ast } = validate(expr, 1)
          return quasiquote(ast, env)
        }
        case ifSym: {
          const { car: pred, cdr: { car: truth, cdr: { car: falsehood } } } = validate(expr, 3)
          const predEvaled = evalFn(env, pred)
          if (predEvaled !== nil)
            expr = truth
          else
            expr = falsehood
          continue loop
        }
        case condSym: {
          const { cdr: arglist } = expr
          if (!isCons(arglist))
            return nil
          for (const pair of listToIterable(arglist, false)) {
            if (!isCons(pair))
              throw new TypeError(`clause ${printExpression(pair)} should be a list`)
            const predicate = car(pair)
            const result = cdr(pair)
            const predEvaled = evalFn(env, predicate)
            if (predEvaled === nil) continue
            if (!isCons(result)) return predEvaled
            expr = car(result)
            continue loop
          }
          return nil
        }
        case defineSym: {
          const { car: name, cdr: { car: valueUneval } } = validate(expr, 2)
          if (typeof name !== 'symbol')
            throw new TypeError(`${printExpression(name)} is not a symbol and so cannot be used to bind a name`)
          const value = evalFn(env, valueUneval)
          // set the name if this is the first time the lambda has been named
          if (isLambdaFn(value) && !value.name) {
            value.name = name.description
          }
          return setValue(env, name, value)
        }
        case lambdaSym: {
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
          const { car: arglist, cdr: { car: body } } = validate(expr, 2)
          const lambdalist = argumentlist(arglist)
          const num = numParams(lambdalist)

          return {
            kind: 'lambda' as 'lambda',
            numParams: num,
            params: lambdalist,
            body,
            env
          }
        }
      }
    }

    const fncall = evalSExpression(env, expr)
    const f = car(fncall)

    if (!isLambdaFn(f) && !isBoostrapFn(f)) {
      throw new TypeError(`${printExpression(fnRef)} is not a procedure`)
    }

    if (isLambdaFn(f)) {
      const args = validate(fncall, f.numParams)
      expr = f.body
      env = bindParams(pushTable(env), args, f.params)
      continue loop
    }

    return f.body(fncall)
  }
}
