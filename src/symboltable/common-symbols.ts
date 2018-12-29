import { symExpr } from '../util'
import { SExpression } from '../SExpression'

export const t = symExpr('t')
export const f = symExpr('f')
export type T = typeof t
export type F = typeof f
export const isT = (e: SExpression): e is T => e === t
export const isF = (e: SExpression): e is F => e === f

export const condSym = symExpr('cond')
export const quoteSym = symExpr('quote')
export const quasiquoteSym = symExpr('quasiquote')
export const unquoteSym = symExpr('unquote')
export const unquoteSpliceSym = symExpr('unquote-splicing')
export const defineSym = symExpr('define')
export const lambdaSym = symExpr('lambda')
export const macroSym = symExpr('macro')
