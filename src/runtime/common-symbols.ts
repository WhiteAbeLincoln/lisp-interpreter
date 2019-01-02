import { InternedSymbol } from './SExpression'

// we shouldn't have a problem using the global symbol registry,
// since these symbols are not ever used by native js code - no chance of conflicts/misuse
export const symExpr =
  <T extends string>(value: T): InternedSymbol<T> => {
    const v = Symbol.for(value)
    return v as unknown as InternedSymbol<T>
  }

export const condSym = symExpr('cond')
export const quoteSym = symExpr('quote')
export const quasiquoteSym = symExpr('quasiquote')
export const unquoteSym = symExpr('unquote')
export const unquoteSpliceSym = symExpr('unquote-splicing')
export const defineSym = symExpr('define')
export const lambdaSym = symExpr('lambda')

export const t = symExpr('t')
export const f = symExpr('f')
export type T = typeof t
export type F = typeof f
