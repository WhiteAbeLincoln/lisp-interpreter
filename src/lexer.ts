import { tuple } from './util'

export type TokenBase = {
  origvalue: string
  line: number
  column: number
}
export type OpenParen = { kind: 'paren'; value: 'open' } & TokenBase
export type CloseParen = { kind: 'paren'; value: 'close' } & TokenBase
export type ParenToken = OpenParen | CloseParen
export type SymToken = { kind: 'symbol'; value: string } & TokenBase
export type NumToken = { kind: 'number'; value: number } & TokenBase
export type StringToken = { kind: 'string'; value: string } & TokenBase
export type ListDelimToken = { kind: 'dot'; value: '.' } & TokenBase
export type QuoteToken = {
  kind: 'quote'
  value: 'quote' | 'quasiquote' | 'unquote' | 'unquote-splicing'
} & TokenBase
export type Token = SymToken | NumToken | ParenToken | StringToken | ListDelimToken | QuoteToken

export const isNum = (tok: Token): tok is NumToken => tok.kind === "number";
isNum.matches = 'number' as 'number'

export const isString = (tok: Token): tok is StringToken => tok.kind === 'string'
isString.matches = 'string' as 'string'

export const isSymbol = (tok: Token): tok is SymToken => tok.kind === 'symbol'
isSymbol.matches = 'symbol' as 'symbol'

export const isDotDelim = (tok: Token): tok is ListDelimToken => tok.kind === 'dot'
isDotDelim.matches = 'dot' as 'dot'

export const isQuote = (tok: Token): tok is QuoteToken => tok.kind === 'quote'
isQuote.matches = 'quote' as 'quote'

export const printToken = (tok: Token): string => {
  switch (tok.kind) {
    case 'number':
      return `Number(${tok.value})`
    case 'paren':
      return tok.origvalue
    case 'symbol':
      return `Symbol(${tok.value})`
    case 'string':
      return `String(${tok.value})`
    case 'dot':
      return '.'
    case 'quote':
      return 'quote'
  }
}

/**
 * Creates a state and a function that operates on that state to increment line and column numbers
 *
 * See React Hooks for a similar concept
 * @param obj optional initial position state
 */
export const usePositionState = (
  obj: { line: number; col: number } = { line: 1, col: 0 },
) =>
  tuple(obj as Readonly<typeof obj>, (v: string) => {
    if (v === '\n') {
      obj.line++
      obj.col = 0
    } else {
      obj.col += v.length
    }
  })

export const whitespace = /\s/
export const number = /[0-9]/

export const syntaxError = (
  char: string,
  { line, col }: { line: number; col: number },
) => new SyntaxError(`Unexpected token \`${char}\` at ${line}:${col}`)

type AutomatonState = {
  pos: { line: number; col: number }
  accum: { line: number; col: number; value: string }
  output: Token[]
  index: number
  input: string
  finished: boolean
}

const accumulate = (a: AutomatonState, str?: string) => {
  const current = str || a.input[a.index - 1]
  if (a.accum.line === 0) {
    a.accum.line = a.pos.line
  }
  if (a.accum.col === 0) {
    a.accum.col = a.pos.col
  }
  a.accum.value += current
}

const retract = (a: AutomatonState) => {
  const current = a.input.charAt(--a.index)
  if (current === '\n') {
    a.pos.line--
    const lastNewline = a.input.lastIndexOf('\n', a.index)
    a.pos.col = a.index - lastNewline
  } else {
    a.pos.col--
  }
}
const ret = (a: AutomatonState, token: Token) => {
  a.output.push(token)
  a.accum = { line: 0, col: 0, value: '' }
}

const getNextChar = (a: AutomatonState) => {
  const char = a.input.charAt(a.index)
  if (a.index < a.input.length) {
    a.index += 1
  }
  return char
}

const createReader = (
  setPosFrom: (v: string) => void,
  a: AutomatonState,
) => () => {
  const c = getNextChar(a)
  setPosFrom(c)
  return c
}

/**
 * Use this lexer
 * TODO: rewrite lexer to be pull based with generators (so that parser can ask for input instead of holding whole text in memory)
 * @param input an input as a string
 */
export const lexer = (input: string) => {
  const [pos, setPosFrom] = usePositionState()
  const a: AutomatonState = {
    pos,
    accum: { line: 0, col: 0, value: '' },
    output: [],
    index: 0,
    input,
    finished: false,
  }

  let c: string

  const read = createReader(setPosFrom, a)

  do {
    c = read()
    if (whitespace.test(c)) continue
    else if (c === '(' || c === ')')
      // PARENTHESES
      ret(a, {
        kind: 'paren',
        value: c === '(' ? 'open' : 'close',
        origvalue: c,
        line: a.pos.line,
        column: a.pos.col,
      } as ParenToken)
    else if (c === ';') {
      // COMMENT
      // read until eof or newline
      do {
        c = read()
        /* matching the behavior of racket, line comment is read until the next
          - linefeed
          - carriage return
          - unicode NEXT LINE
          - unicode LINE SEPARATOR
          - unicode PARAGRAPH SEPARATOR
          - EOF
        */
      } while (c !== '\n' && c !== '\r' && c !== '\u0085' && c !== '\u2028' && c !== '\u2029' && c !== '')
    } else if (c === '"') {
      // STRING
      matchString(read, a)
    } else if (c === '\\') {
      // ESCAPED SYMBOL
      matchNumberOrSym(read, a, true)
    } else if (c === '\'' || c === '`') {
      // QUOTE SUGAR

      const quoteType: QuoteToken['value']
        = c === '\'' ? 'quote'
        : c === '`' ? 'quasiquote'
        : c

      ret(a, {
        kind: 'quote',
        value: quoteType,
        origvalue: c,
        line: a.pos.line,
        column: a.pos.col
      })
    } else if (c === ',') {
      accumulate(a)
      const next = read()
      if (next === '@') {
        ret(a, {
          kind: 'quote'
        , value: 'unquote-splicing'
        , origvalue: a.accum.value + next
        , line: a.accum.line
        , column: a.accum.col
        })
      } else {
        ret(a, {
          kind: 'quote'
        , value: 'unquote'
        , origvalue: a.accum.value
        , line: a.accum.line
        , column: a.accum.col
        })
        retract(a)
      }
    } else if (c !== '') {
      // NUMBER, SYMBOL
      // try to match number or symbol
      // if number doesn't match, match symbol

      // first stick the character in the accumulation buffer
      accumulate(a)
      matchNumberOrSym(read, a)
    }
  } while (c !== '')

  return a.output
}

const numberRegex = /^[-+]?[0-9]*\.?[0-9]+$/
export const isNumber = (buffer: string): boolean => {
  return numberRegex.test(buffer)
  // const [first, ...rest] = buffer
  // const seenSign = first === '-' || first === '+'
  // let seenPeriod = first === '.'
  // // first must be a sign, a number char, or a period
  // if (!seenSign && !number.test(first) && !seenPeriod) return false
  // // we must have more characters than just sign or period
  // if ((seenSign || seenPeriod) && rest.length === 0) return false
  // // rest must be all number char or a period, but period cannot occur multiple times
  // for (const c of rest) {
  //   if (c === '.' && !seenPeriod) {
  //     seenPeriod = true
  //     continue
  //   } else if (number.test(c)) continue
  //   else return false
  // }

  // return true
}

const isDelimiterChar = (
  char: string,
): char is '(' | ')' | '\n' | '\t' | ' ' | '"' | ',' | '\'' | '`' | ';' | '' =>
     char === '('
  || char === ')'
  || whitespace.test(char)
  || char === ''
  || char === '"'
  || char === ','
  || char === '\''
  || char === '`'
  || char === ';'


export const EscapeTable: { [str: string]: string | undefined } = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  v: '\v',
  '0': '\0',
}

export const unescape = (chr: string): string => {
  return EscapeTable[chr] || chr
}

/** adds a number to the output array if accumulation buffer is a valid number (single period, optional sign [-+], number)
 * adds a symbol otherwise
 */
export const matchNumberOrSym = (
  read: () => string,
  a: AutomatonState,
  escape = false,
) => {
  // read characters until we reach a separation character: ; ( \n ) ' '
  let chr: string
  let lastWasEscape = escape
  let escapedDot = false
  while (true) {
    chr = read()
    if (chr === '' && !lastWasEscape) break

    if (lastWasEscape) {
      if (chr === '.') escapedDot = true
      if (chr === '')
        throw new SyntaxError(
          `Unterminated escape sequence at ${a.pos.line}:${a.pos.col - 1}`,
        )
      accumulate(a, unescape(chr))
    } else if (isDelimiterChar(chr)) {
      retract(a)
      break
    }
    else if (chr !== '\\') accumulate(a)
    lastWasEscape = !lastWasEscape && chr === '\\'
  }

  // returns
  if (a.accum.value === '.' && !escapedDot)
    ret(a, {
      kind: 'dot',
      value: '.',
      origvalue: '.',
      line: a.accum.line,
      column: a.accum.col
    })
  else if (isNumber(a.accum.value))
    ret(a, {
      kind: 'number',
      value: parseFloat(a.accum.value),
      origvalue: a.accum.value,
      line: a.accum.line,
      column: a.accum.col,
    })
  else
    ret(a, {
      kind: 'symbol',
      value: a.accum.value,
      origvalue: a.accum.value,
      line: a.accum.line,
      column: a.accum.col,
    })
}

export const matchString = (read: () => string, a: AutomatonState) => {
  let chr: string
  // read until we reach an unescaped quote
  // if we reach eof, throw error
  let lastWasEscape = false
  while (true) {
    chr = read()
    if (chr === '') break

    if (lastWasEscape) {
      accumulate(a, unescape(chr))
    } else if (chr !== '"' && chr !== '\\') {
      accumulate(a, chr)
    }

    if (chr === '"' && !lastWasEscape) break
    lastWasEscape = !lastWasEscape && chr === '\\'
  }

  if (chr === '')
    throw new SyntaxError(
      `Unterminated string at ${a.accum.line}:${a.accum.col}`,
    )

  ret(a, {
    kind: 'string',
    value: a.accum.value,
    origvalue: a.accum.value,
    line: a.accum.line,
    column: a.accum.col,
  })
}
