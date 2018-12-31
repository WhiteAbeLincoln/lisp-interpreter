import { SymbolTable } from './symboltable/symboltable'
import { andT, or } from './match/functional'
import { Overwrite, MakeKeysOptional } from './match/types'
import { typeOf } from './match/predicates'
import { isCons } from './Cons'

export type EmptyList = { readonly kind: 'empty' }
export type SExpression =  string | number | symbol | Cons | EmptyList | LambdaFn | BootstrapFn

export const isEmptyList = (v: SExpression): v is EmptyList => typeof v === 'object' && v.kind === 'empty'
export const empty: EmptyList = { kind: 'empty' }

export type Cons = {
  readonly kind: 'cons'
  readonly proper: boolean
  readonly car: SExpression
  readonly cdr: SExpression
}

export type LambdaParam = { sym: symbol, variadic?: true }

export type LambdaFn = {
  readonly kind: 'lambda'
  name?: string
  numParams: [number, number]
  curried: false | Array<SExpression>
  params: LambdaParam[]
  body: SExpression
  env: SymbolTable | (() => SymbolTable)
  macro: boolean
}

export type MacroFn = Overwrite<LambdaFn, { macro: true }>

export type BootstrapFn = {
  readonly kind: 'boostrap'
  name: string
  numParams: [number, number]
  curried: false | Array<SExpression>
  body: (fncall: Cons, env: SymbolTable, numParams: [number, number]) => SExpression
}

export const isPrimitive = (v: SExpression): v is Exclude<SExpression, Cons> =>
  typeOf('string', 'number', 'symbol')(v) || v.kind !== 'cons'

export const isSExpression = (v: unknown): v is SExpression =>
  typeOf('string', 'number', 'symbol')(v) ||
  v === empty ||
  (typeof v === 'object' && v !== null && ['lambda', 'boostrap', 'cons'].includes((v as any).kind))
  || false

export const isLambdaFn = (v: SExpression): v is LambdaFn =>
  typeof v === 'object' && v.kind === 'lambda'

export const isBoostrapFn = (v: SExpression): v is BootstrapFn =>
  typeof v === 'object' && v.kind === 'boostrap'

export const isProcedure = or(isLambdaFn, isBoostrapFn)

export const isMacro = andT(isLambdaFn, (l): l is MacroFn => l.macro)

export type SExprTypeName =
  | 'pair'
  | 'unit'
  | 'procedure'
  | 'string'
  | 'number'
  | 'symbol'

export const sexprTypeOf = (arg: SExpression): SExprTypeName =>
    isCons(arg)       ? 'pair'
  : isEmptyList(arg)  ? 'unit'
  : isProcedure(arg)  ? 'procedure'
  : typeOf('string', 'number', 'symbol')(arg) ? typeof arg as 'string' | 'number' | 'symbol'
  : arg

export const lambda = (
  lambdaDef: MakeKeysOptional<
      Pick<
        LambdaFn,
        'name' | 'numParams' | 'params' | 'body' | 'env' | 'macro'>
    , 'macro'> & { curried?: boolean }
): LambdaFn => ({
  kind: 'lambda'
, ...lambdaDef
, macro: lambdaDef.macro ? true : false
, curried: lambdaDef.curried ? [] : false
})

export const arity = (fn: BootstrapFn | LambdaFn): [number, number] => {
  const [, max] = fn.numParams
  return fn.curried ? [1, max - fn.curried.length] : fn.numParams
}
