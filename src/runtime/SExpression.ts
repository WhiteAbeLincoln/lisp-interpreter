import { andT, or } from '../util/functional/contracts'
import { Overwrite, MakeKeysOptional } from '../util/functional/types'
import { typeOf } from '../util/functional/predicates'
import { T, t, f, F } from './common-symbols'

export const SKind = Symbol('kind')

// Type Definitions
export type InternedSymbol<T extends string> = symbol & { description: T }
export type EmptyList = { readonly [SKind]: 'empty' }

export type Cons = {
  readonly [SKind]: 'cons'
  readonly proper: boolean
  readonly car: SExpression
  readonly cdr: SExpression
}

export type LambdaParam = { sym: symbol, variadic?: true }

export type SymbolTable = { parent: SymbolTable | null, table: Map<symbol, SExpression> }

export type LambdaFn = {
  readonly [SKind]: 'lambda'
  name?: string
  numParams: [number, number]
  curried: false | Array<SExpression>
  params: LambdaParam[]
  body: SExpression
  env: SymbolTable | (() => SymbolTable)
  macro: boolean
}

export type BootstrapFn = {
  readonly [SKind]: 'boostrap'
  name: string
  numParams: [number, number]
  curried: false | Array<SExpression>
  body: (fncall: Cons, env: SymbolTable, numParams: [number, number]) => SExpression
}

export type MacroFn = Overwrite<LambdaFn, { macro: true }>

export type SExpression =  string | number | symbol | Cons | EmptyList | LambdaFn | BootstrapFn

export type SExprTypeName =
  | 'pair'
  | 'unit'
  | 'procedure'
  | 'string'
  | 'number'
  | 'symbol'

export interface ConsG<Car extends SExpression = SExpression, Cdr extends SExpression = SExpression> extends Cons {
  kind: 'cons'
  car: Car
  cdr: Cdr
}

type ProperPair = Overwrite<Cons, { proper: true }>

export type List = EmptyList | ProperPair

// Predicates

export const isT = (e: SExpression): e is T => e === t
export const isF = (e: SExpression): e is F => e === f

export const isInterned = (s: symbol) => Symbol.keyFor(s) === s.description

export const isEmptyList = (v: SExpression): v is EmptyList =>
  typeof v === 'object' && v[SKind] === 'empty'

/**
 * Predicate that determines if the SExpression is a cons chain terminated with '()
 * @param c
 */
export const isProperList = (v: unknown): v is List =>
  v === empty || (isCons(v) && v.proper)


export const isPrimitive = (v: SExpression): v is Exclude<SExpression, Cons> =>
  typeOf('string', 'number', 'symbol')(v) || v[SKind] !== 'cons'

export const isSExpression = (v: unknown): v is SExpression => {
  if (typeOf('string', 'number', 'symbol')(v)) return true

  if (typeof v !== 'object' || v === null) return false
  const val = v as Exclude<SExpression, string | number | symbol>

  return (
       val[SKind] === 'boostrap'
    || val[SKind] === 'cons'
    || val[SKind] === 'empty'
    || val[SKind] === 'lambda'
  )
}

export const isLambdaFn = (v: SExpression): v is LambdaFn =>
  typeof v === 'object' && v[SKind] === 'lambda'

export const isBoostrapFn = (v: SExpression): v is BootstrapFn =>
  typeof v === 'object' && v[SKind] === 'boostrap'

export const isCons = (c: unknown): c is Cons =>
  typeof c === 'object' && c !== null && (c as Exclude<SExpression, string | number | symbol>)[SKind] === 'cons'

export const isProcedure = or(isLambdaFn, isBoostrapFn)

export const isMacro = andT(isLambdaFn, (l): l is MacroFn => l.macro)

// Constructors

export const empty: EmptyList = { [SKind]: 'empty' }

export const cons = (car: unknown, cdr: unknown): Cons => {
  if (!isSExpression(car) || !isSExpression(cdr))
    throw new Error(`cons: expected a valid value, got | car: ${JSON.stringify(car)}, cdr: ${JSON.stringify(cdr)} |`)
  return {
    car,
    cdr,
    proper: isCons(cdr) ? cdr.proper : cdr === empty,
    [SKind]: 'cons',
  }
}

export const consProper = (car: SExpression): Cons => cons(car, empty)

export const lambda = (
  lambdaDef: MakeKeysOptional<
      Pick<
        LambdaFn,
        'name' | 'numParams' | 'params' | 'body' | 'env' | 'macro'>
    , 'macro'> & { curried?: boolean }
): LambdaFn => ({
  [SKind]: 'lambda'
, ...lambdaDef
, macro: lambdaDef.macro ? true : false
, curried: lambdaDef.curried ? [] : false
})

export const createBoostrap = (
  body: BootstrapFn['body'],
  name: string,
  numParams: [number, number] | number,
  curry?: boolean,
): BootstrapFn => ({
  [SKind]: 'boostrap',
  name,
  body,
  numParams:
    typeof numParams === 'number'
      ? [numParams, numParams]
      :  numParams,
  curried: curry ? [] : false,
})
