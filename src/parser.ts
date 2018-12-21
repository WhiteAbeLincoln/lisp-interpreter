import { cons, consProper } from './Cons'
import {
  CloseParen, isDotDelim, isNum, isQuote,
  isString, isSymbol, NumToken, OpenParen,
  ParenToken, printToken, StringToken, SymToken,
  Token, QuoteToken, lexer
} from './lexer'
import { or } from './match/functional'
import { quoteSym, nil, quasiquoteSym, unquoteSym, unquoteSpliceSym } from './symboltable/common-symbols'
import { arrayReadFun, Reader, Refinement, symExpr } from './util'
import { SExpression, Cons } from './SExpression'

const isParen = (tok: Token): tok is ParenToken => tok.kind === 'paren'

const isOpenparen = (tok: Token): tok is OpenParen =>
  isParen(tok) && tok.value === 'open'
  isOpenparen.matches = '(' as '('

const isCloseparen = (tok: Token): tok is CloseParen =>
  isParen(tok) && tok.value === 'close'
  isCloseparen.matches = ')' as ')'

export const quoteSexpr = (e: SExpression, type: QuoteToken['value']) =>
  cons(
      type === 'quote'            ? quoteSym
    : type === 'quasiquote'       ? quasiquoteSym
    : type === 'unquote'          ? unquoteSym
    : type === 'unquote-splicing' ? unquoteSpliceSym
    : type
    , consProper(e)
  )

const isAtom = (e: Token): e is StringToken | NumToken | SymToken =>
  e.kind === 'string'
  || e.kind === 'number'
  || e.kind === 'symbol'

const expectingSyntaxError = (expecting: string, lookahead?: Token) => {
  const tokString = (lookahead && printToken(lookahead)) || "ε"
  return new SyntaxError(
    `Expected ${expecting} but recieved ${tokString} at ${lookahead ? lookahead.line + ':' + lookahead.column : 'EOF'}`
  )
}

const sExprEntrySet = or(isOpenparen, isAtom, isQuote)


export const parser = (toks: Token[]) => {
  const reader = new Reader(arrayReadFun(toks))
  let lookahead = reader.peek()[0] as Token | undefined

  const program = () => {
    const output: SExpression[] = []
    while (true) {
      if (lookahead && (sExprEntrySet(lookahead))) {
        output.push(sexp())
      } else {
        break
      }
    }
    return output
  }

  const sexp = (): SExpression => {
    if (lookahead) {
      if (isQuote(lookahead)) return qte()
      if (isNum(lookahead)) return num()
      if (isString(lookahead)) return str()
      if (isSymbol(lookahead)) return sym()
    }
    match(isOpenparen)
    if (lookahead && isCloseparen(lookahead)) {
      // the empty list or nil
      match(isCloseparen)
      return nil
    }
    const first = sexp()
    return list(first)
  }

  const list = (first?: SExpression): Cons => {
    if (typeof first === 'undefined') {
      match(isOpenparen)
      first = sexp()
    }
    let head = consProper(first)
    let pointer = head
    while (lookahead && !isCloseparen(lookahead)) {
      // if we have a cons construction
      // match the next s-expression, close the list
      // and return
      if (isDotDelim(lookahead)) {
        match(isDotDelim)
        pointer.cdr = sexp()
        break
      }
      const next = sexp()
      const nextConsList = consProper(next)
      // attach the nextConsList to the current
      pointer.cdr = nextConsList
      // make pointer point to the next
      pointer = nextConsList
    }
    match(isCloseparen)
    return head
  }

  const num = () => {
    const val = match(isNum)
    return val.value
  }

  const str = () => {
    const val = match(isString)
    return val.value
  }

  const sym = () => {
    const val = match(isSymbol)
    return symExpr(val.value)
  }

  const qte = () => {
    const val = match(isQuote)
    return quoteSexpr(sexp(), val.value)
  }

  const match = <B extends Token>(
    p: Refinement<Token, B> & { matches?: Token['kind'] | '(' | ')' }
  ): B => {
    if (lookahead && p(lookahead)) {
      const old = lookahead
      reader.read()
      lookahead = reader.peek()[0]
      return old
    } else {
      throw expectingSyntaxError(
        p.matches ? p.matches : `token fulfilling predicate ${p.name || p}`,
        lookahead
      )
    }
  }

  const data = program()
  if (!reader.done) {
    throw expectingSyntaxError('s-expression', lookahead)
  }

  return data
}
