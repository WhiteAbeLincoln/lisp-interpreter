import {
  SExpression, isSExpression, createBoostrap,
  isProcedure, isCons, isEmptyList, SExprTypeName
} from './SExpression'
import { t, f } from './common-symbols'
import { validate } from '../symboltable/symboltable'
import { listToIterable, fromArray } from './Cons'
import { typeOf } from '../match/predicates';

export const symDesc = (a: symbol) => (a as typeof a & { description?: string }).description
export const boolToLisp = (v: unknown) => v === false ? f : t
export const boolLispToJs = (v: unknown) => v === f ? false : true

export const sexprTypeOf = (arg: SExpression): SExprTypeName =>
    isCons(arg)       ? 'pair'
  : isEmptyList(arg)  ? 'unit'
  : isProcedure(arg)  ? 'procedure'
  : typeOf('string', 'number', 'symbol')(arg) ? typeof arg as 'string' | 'number' | 'symbol'
  : arg


export const arity = (fn: unknown): [number, number] => {
  if (!isSExpression(fn) || !isProcedure(fn))
    throw new Error('arity: fn is not a procedure')

  const [, max] = fn.numParams
  return fn.curried ? [1, max - fn.curried.length] : fn.numParams
}

export const marshallValue = (evaluated: unknown): SExpression | null => {
  if (isSExpression(evaluated))
    return evaluated

  if (typeof evaluated === 'function')
    return createBoostrap(
      (fncall, _env, numParams) => {
        const args = validate(fncall, numParams)
        const argsArr = listToIterable(args)
        const result: unknown = evaluated(...argsArr)

        const val = marshallValue(result)

        if (val === null)
          throw new Error(`function ${evaluated.name} returned invalid value`)

        return val
      },
      evaluated.name,
      evaluated.length,
      evaluated.length > 1,
    )

  if (typeof evaluated === 'boolean')
    return boolToLisp(evaluated)

  if (Array.isArray(evaluated)) {
    const mapped: SExpression[] = []

    for (const x of evaluated as unknown[]) {
      const m = marshallValue(x)
      if (m === null)
        return null
      mapped.push(m)
    }

    return fromArray(mapped)
  }

  return null
}
