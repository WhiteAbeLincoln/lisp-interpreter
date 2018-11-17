/* Execute With:

    npm run build
    node build/index.js
*/

const firstinput = "(* 7 (+ 5 6))"
type Operation = 'mult' | 'div' | 'add' | 'sub'
type ParenToken = { kind: 'paren', value: 'open' | 'close' }
type OpToken = { kind: 'op', value: Operation }
type NumToken = { kind: 'number', value: number }
type Token = OpToken | NumToken | ParenToken


const whitespace = /\s+/
const number = /[0-9]+/
console.log('Hello World')

const lexer = (input: string): Token[] => {
  const split =
    input
            .replace(/\(/g, ' ( ', )
            .replace(/\)/g, ' ) ').split('').filter(x => !whitespace.test(x))
    // const output: Token[] = []

    for (const char of split) {
        if (number.test(char)) output.push({ kind: 'number', value: parseInt(char, 10) })
    }
}
