import { replserver } from "./repl"
import { readFile } from "fs"
import { promisify } from "util"
import { readStdin } from "./util/util"
import { interpreter } from "./interpreter"
import { tuple } from './util/functional/functional'
const rf = promisify(readFile)

const [, , ...args] = process.argv

if (args.includes("--help") || args.includes("-h")) {
  console.log(`USAGE: ts-lisp [OPTIONS] [FILES...]
OPTIONS:
  -r | --repl   Open an interactive REPL
  -             Read from standard input
If FILES is excluded the program will read from standard input
  `)
  process.exit(0)
} else if (args[0] === "-r" || args[0] === "--repl") {
  replserver()
} else if (args[0] === "-" || args.length === 0) {
  // read from standard input
  readStdin()
    .then(text => console.log(interpreter(text)))
    .catch(err => {
      console.error(err.message)
      process.exit(1)
    });
} else {
  // read each file and evaluate
  let errored = false;
  const ps = args.map(file =>
    rf(file, "utf8")
      .then(text => tuple(file, interpreter(text)))
      .then(([file, result]) => console.log(`${file}\n${result}\n`))
      .catch(err => {
        errored = true
        console.error(file + ": " + err.message)
      })
  );
  Promise.all(ps).then(() => process.exit(errored ? 1 : 0))
}
