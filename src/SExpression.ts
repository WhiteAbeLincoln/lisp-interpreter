import { SymbolTable } from './symboltable/symboltable'

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
  params: LambdaParam[]
  body: SExpression
  env: SymbolTable | (() => SymbolTable)
}

export type BootstrapFn = {
  kind: 'boostrap'
  name: string
  body: (fncall: Cons) => SExpression
}

export const isLambdaFn = (v: SExpression): v is LambdaFn =>
  typeof v === 'object' && v.kind === 'lambda'

export const isBoostrapFn = (v: SExpression): v is BootstrapFn =>
  typeof v === 'object' && v.kind === 'boostrap'