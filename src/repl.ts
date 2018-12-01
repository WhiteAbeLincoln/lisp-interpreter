import repl from "repl";
import { interpreter, printExpression } from "./interpreter";
import vm from "vm";

export const replserver = () =>
  repl.start({
    prompt: "tslisp > ",
    eval: (command, context, _file, cb) => {
      let result;
      let outputmode: "ast" | "tokens" | "eval" = "eval";
      if (command.startsWith(":ast")) {
        outputmode = "ast";
        command = command.replace(":ast", "");
      } else if (command.startsWith(":tokens")) {
        outputmode = "tokens";
        command = command.replace(":tokens", "");
      } else if (command.startsWith(":eval")) {
        outputmode = "eval";
        command = command.replace(":eval", "");
      } else if (command.startsWith(":js")) {
        command = command.replace(":js", "");
        try {
          result = vm.runInContext(command, context);
        } catch (err) {
          cb(err, null);
        }
        cb(null, result);
        return;
      }
      try {
        result = interpreter(command, context, outputmode);
      } catch (err) {
        if (isRecoverableError(err)) cb(new repl.Recoverable(err), null);
        else cb(err, null);
      }
      cb(null, result);
    },
    writer: output => {
      return (Array.isArray(output) && !(output as any).kind) || typeof output === 'undefined' ? '' : printExpression(output)
    }
  });

const isRecoverableError = (e: Error) => {
  if (e instanceof SyntaxError) {
    return /^(Unexpected end of input|Unexpected token)/.test(e.message);
  }
  return false;
};
