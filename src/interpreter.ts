import {
  Token,
  lexer,
} from './lexer'
import { symboltable,} from './symboltable/symboltable'
import { parser } from './parser'
import { evalFn } from './eval'
import { SExpression, SymbolTable } from './runtime/SExpression'

/* Execute With:

    npm run build
    node build/index.js

    OR

    npm run exec
*/

const execute = (program: SExpression[], context: SymbolTable = symboltable) => {
  return program.map(v => evalFn(context, v))
}

export function interpreter(input: string, context?: SymbolTable, level?: 'eval'): unknown
export function interpreter(input: string, context?: SymbolTable, level?: 'tokens'): Token[]
export function interpreter(input: string, context?: SymbolTable, level?: 'ast'): SExpression[]
export function interpreter(input: string, context?: SymbolTable, level?: 'ast' | 'tokens' | 'eval'): Token[] | SExpression[]
export function interpreter(input: string, context?: SymbolTable, level: 'ast' | 'tokens' | 'eval' = 'eval') {
  const tokens = lexer(input)
  if (level === 'tokens') return tokens
  const ast = parser(tokens)
  if (level === 'ast') return ast
  const result = execute(ast, context)
  if (result.length === 1) return result[0]
  return result
}
