import { SymbolTable } from './symboltable/symboltable'
import { andT, or } from './match/functional'
import { Overwrite, MakeKeysOptional } from './match/types'

export type SExpression =  string | number | symbol | Cons | LambdaFn | BootstrapFn

export type Cons = {
  kind: 'cons'
  car: SExpression
  cdr: SExpression
}

export type LambdaParam = { sym: symbol, variadic?: true }

export type LambdaFn = {
  kind: 'lambda'
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
  kind: 'boostrap'
  name: string
  numParams: [number, number]
  curried: false | Array<SExpression>
  body: (fncall: Cons, env: SymbolTable, numParams: [number, number]) => SExpression
}

export const isLambdaFn = (v: SExpression): v is LambdaFn =>
  typeof v === 'object' && v.kind === 'lambda'

export const isBoostrapFn = (v: SExpression): v is BootstrapFn =>
  typeof v === 'object' && v.kind === 'boostrap'

export const isProcedure = or(isLambdaFn, isBoostrapFn)

export const isMacro = andT(isLambdaFn, (l): l is MacroFn => l.macro)

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
  return fn.curried ? [0, max - fn.curried.length] : fn.numParams
}
