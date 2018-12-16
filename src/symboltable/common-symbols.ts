import { symExpr } from '../util'
import { SExpression } from '../SExpression'

export const nil = symExpr('nil')
export const t = symExpr('t')
export type Nil = typeof nil
export type T = typeof t
export const isNil = (e: SExpression): e is Nil => e === nil
export const isT = (e: SExpression): e is T => e === t

export const ifSym = symExpr('if')
export const condSym = symExpr('cond')
export const quoteSym = symExpr('quote')
export const defineSym = symExpr('define')
export const lambdaSym = symExpr('lambda')
