import repl from 'repl'
import { interpreter } from './interpreter'
import vm from 'vm'
import { spawn } from 'child_process'
import { printExpression } from './print'

const specialMode = (name: string) => RegExp(`^\\s*:${name}`)
const sAst = specialMode('ast')
const sTokens = specialMode('tokens')
const sEval = specialMode('eval')
const sJs = specialMode('js')
const sShell = specialMode('!')
const sExpand = specialMode('expand')

let expand = false

export const replserver = () =>
  repl.start({
    prompt: 'tslisp > ',
    eval: (command, context, _file, cb) => {
      let result;
      let outputmode: 'ast' | 'tokens' | 'eval' = 'eval';
      if (sAst.test(command)) {
        outputmode = 'ast'
        command = command.replace(sAst, '')
      } else if (sTokens.test(command)) {
        outputmode = 'tokens'
        command = command.replace(sTokens, '')
      } else if (sEval.test(command)) {
        outputmode = 'eval'
        command = command.replace(sEval, '')
      } else if (sJs.test(command)) {
        command = command.replace(sJs, '')
        try {
          result = vm.runInContext(command, context)
        } catch (err) {
          cb(err, null)
        }
        cb(null, result)
        return
      } else if (sShell.test(command)) {
        command = command.replace(sShell, '')
        const shell = spawn('/bin/bash', ['-c', command])
        // we should be able to write multiple times and then end
        // however repl doesn't let us do that
        shell.stderr.pipe(process.stderr)
        shell.stdout.pipe(process.stdout)
        shell.on('close', () => {
          cb(null, null)
        })
        return
      } else if (sExpand.test(command)) {
        command = command.replace(sExpand, '')
        if (command.trim() === 't') expand = true
        else expand = false
        cb(null, null)
        return
      }
      try {
        result = interpreter(command, /*context*/undefined, outputmode);
      } catch (err) {
        if (isRecoverableError(err)) cb(new repl.Recoverable(err), null);
        else cb(err, null);
      }
      cb(null, result);
    },
    writer: output => {
      if (output == null) return ''
      return Array.isArray(output) ? output.map(v => printExpression(v, expand)).join('\n') : printExpression(output, expand)
    }
  });

const isRecoverableError = (e: Error) => {
  if (e instanceof SyntaxError) {
    return /^(Unexpected end of input|Unexpected token)/.test(e.message);
  }
  return false;
};
