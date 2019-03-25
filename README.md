# TSLisp

A simple lisp interpreter, written in typescript, and modeled after Common Lisp and Scheme.

The parser and lexer are both custom, and because of the support for [first-class macros](http://matt.might.net/articles/metacircular-evaluation-and-first-class-run-time-macros/),
most of the central language features can be self-hosted,
written in tslisp as a default library instead of written
in typescript.
