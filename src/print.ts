import { listToIterable, fromArray } from './runtime/Cons'
import { quoteSym, quasiquoteSym, unquoteSpliceSym, unquoteSym } from './runtime/common-symbols'
import { SExpression, isLambdaFn, isBoostrapFn, isMacro, empty, isEmptyList, isCons } from './runtime/SExpression'
import { symDesc } from './runtime/utility'

export const printExpression = (val: SExpression, expand = false): string => {
  if (typeof val === 'string') return `"${val}"`
  if (typeof val === 'number') return String(val)
  // TODO: handle special symbol names (like escaped chars)
  // clisp prints symbol names that required escaping surrounded by |
  // e.g. '\ a\ b\ c is printed as | a b c|
  if (typeof val === 'symbol') return `${symDesc(val)}` || '[Unknown Symbol]'
  if (isCons(val)) {
    // to match the printing that clisp does
    // we print as list until last cons
    // if cdr is not nil, i.e. val is an improper list
    // we print a . and then cdr
    let str = '('
    const consArr = [...listToIterable(val, true)]
    // special case for proper quotes
    if (consArr.length === 3 && consArr[2] === empty && !expand) {
      const quote = consArr[0]
      const quoteType
        = quote === quoteSym ? '\''
        : quote === quasiquoteSym ? '`'
        : quote === unquoteSym ? ','
        : quote === unquoteSpliceSym ? ',@'
        : ''

      if (quoteType !== '') {
        return  `${quoteType}${printExpression(consArr[1], expand)}`
      }
    }
    for (let i = 0; i < consArr.length; ++i) {
      const car = consArr[i]
      if (i === consArr.length - 1 && !isEmptyList(car)) {
        // TODO: find a way to remove recursion here
        str += ` . ${printExpression(car, expand)}`
      } else if (i === consArr.length - 1) {
        break
      } else {
        str += `${str === '(' ? '' : ' '}${printExpression(car, expand)}`
      }
    }
    str += ')'
    return str
  }
  if (isLambdaFn(val) || isBoostrapFn(val)) {
    const kind = isMacro(val) ? 'macro' : 'procedure'
    const name = val.name ? ':' + val.name : ''
    const curry = val.curried && val.curried.length > 0 ? `:${printExpression(fromArray(val.curried), expand)}` : ''
    return `<${kind}${name}${curry}>`
  }
  if (isEmptyList(val))
    return '()'
  return val
}
