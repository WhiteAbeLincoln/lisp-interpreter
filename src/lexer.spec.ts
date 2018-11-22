import fc from 'fast-check'
import { truthy, tuple, id, compose } from './util'
import { Token, ParenToken, NumToken, usePositionState, lexer } from './lexer'

/**
 * Generates a string consisting of (, ), and whitespace
 *
 * Verifies that whitespace and parens work as expected
 */
const parenArbitrary = () =>
  fc.stringOf(
    fc.oneof(
      fc.constant('('),
      fc.constant(')'),
      fc.constant(' '),
      fc.constant('\n'),
    ),
  )

/**
 * Generates a string consisting of only integer numbers and whitespace
 *
 * Verifies that integer numbers work as expected
 */
const integerArbitrary = (negative = false) => {
  const num = negative ? fc.integer() : fc.nat()
  return fc.stringOf(
    fc.oneof(
      num.map(v => String(v) + ' '),
      fc.constant(' '),
      fc.constant('\n'),
    ),
  )
}

/**
 * Generates a string consisting only of double precision floating point numbers and whitespace
 *
 * Verifies that floating point numbers work as expected
 */
const doubleArbitrary = (negative = false) => {
  const num = fc.double(10000)
  const pos = num.map(
    v => String(v) + ' ' /* ensures that we don't get double periods */,
  )
  const neg = num.map(v => String(-v) + ' ')
  const arr = [pos]
  if (negative) arr.push(neg)
  return fc.stringOf(fc.oneof(fc.constant(' '), fc.constant('\n'), ...arr))
}

const withoutLeadingZero = (v: number) => {
  const num = String(v)
  return num.startsWith('0.') ? num.slice(1) : num
}

/**
 * Generates a string consisting only of single precision floating point numbers and whitespace
 *
 * Verifies that floating point numbers work as expected
 */
const floatArbitrary = (negative = false) => {
  const num = fc.float(10000)

  const neg = (v: number) => -v
  const orig = [id, ...(negative ? [neg] : [])]
  const withoutLeading = orig.map(fn =>
    compose(
      withoutLeadingZero,
      fn,
    ),
  )
  const str = orig.map(fn =>
    compose(
      v => String(v),
      fn,
    ),
  )
  const all = [...withoutLeading, ...str].map(fn =>
    compose(
      v => v + ' ',
      fn,
    ),
  ) /* ensures that we don't get double periods */
  const arbitraries = all.map(fn => num.map(fn))
  return fc.stringOf(
    fc.oneof(fc.constant(' '), fc.constant('\n'), ...arbitraries),
  )
}

/**
 * Generates a string from the full ascii set, prefixed with ';' for Comment
 * and suffixed with '\n(' for OpenParen
 *
 * Verifies that a comment ignores an entire line, and stops after a newline
 */
const commentArbitrary = () => fc.ascii().map(v => ';' + v + '\n(')

/**
 * Utility method to check if the result of lexing is equal to the expected result created
 * by the given function
 * @param createExpected a function to create an expected list of tokens
 */
const isListOf = (
  createExpected: (str: string) => Token[],
  check: { kind?: boolean; col?: boolean; line?: boolean; value?: boolean } = {
    kind: true,
    col: true,
    line: true,
    value: true,
  },
) => (str: string) => {
  const expected = createExpected(str)
  const lexerRes = lexer(str)
  if (lexerRes.length !== expected.length) {
    throw new Error(
      `Expected number of results ${expected.length} does not match ${
        lexerRes.length
      }`,
    )
  }
  lexerRes.forEach((v, i) => {
    const exp = expected[i]
    const kind =
      check.kind &&
      exp.kind !== v.kind &&
      `Expected kind ${exp.kind} does not match ${v.kind}`
    const col =
      check.col &&
      exp.column !== v.column &&
      `Expected col ${exp.column} does not match ${v.column}`
    const line =
      check.line &&
      exp.line !== v.line &&
      `Expected line ${exp.line} does not match ${v.line}`
    const value =
      check.value &&
      exp.value !== v.value &&
      `Expected value ${exp.value} does not match ${v.value}`
    const message = kind || col || line || value
    if (message) {
      throw new Error(message)
    }
  })
  return true
}

const isListOfParens = isListOf(str => {
  const [pos, setPosFrom] = usePositionState()
  return str
    .split('')
    .map(v => {
      setPosFrom(v)
      if (v === '(' || v === ')') {
        return {
          kind: 'paren',
          value: v === '(' ? 'open' : 'close',
          column: pos.col,
          line: pos.line,
        } as ParenToken
      }
      return null
    })
    .filter(truthy)
})

const isListOfNumbers = isListOf(str => {
  const [pos, setPosFrom] = usePositionState()
  const split = str
    .split('')
    .map(c => {
      setPosFrom(c)
      return tuple({ ...pos }, c)
    })
    .filter(([, c]) => c !== '' && c !== ' ' && c !== '\n')
  if (split.length === 0) return split as never[]
  const [fst, ...rest] = split
  return rest
    .reduce(
      (acc, c) => {
        const p = acc[acc.length - 1]
        const before = acc.slice(0, acc.length - 1)

        if (c[0].col === p[0].col + p[1].length && c[0].line === p[0].line) {
          // this current character is next to the previous value
          // i.e. no newline or space in between
          return [...before, tuple(p[0], p[1] + c[1])]
        }
        return [...acc, c]
      },
      [fst],
    )
    .map(
      ([pos, v]) =>
        ({
          kind: 'number',
          value: +v,
          column: pos.col,
          line: pos.line,
        } as NumToken),
    )
})

const isEmptyResult = isListOf(() => [])

const isSingleResult = (
  fun: (str: string) => Token,
  check?: Parameters<typeof isListOf>[1],
) => isListOf(str => [fun(str)], check)

describe('lexer', () => {
  it('parses a set of parentheses', () => {
    fc.assert(fc.property(parenArbitrary(), isListOfParens))
  })

  it('parses comments with the full ascii set', () => {
    fc.assert(
      fc.property(
        commentArbitrary(),
        isSingleResult(
          str =>
            ({
              kind: 'paren',
              value: 'open',
              column: 1,
              line: str.split('\n').length,
            } as ParenToken),
        ),
      ),
    )
  })

  it('parses integer numbers', () => {
    fc.assert(fc.property(integerArbitrary(true), isListOfNumbers))
  })

  it('parses single precision floating point numbers', () => {
    fc.assert(fc.property(floatArbitrary(true), isListOfNumbers))
  })
})
