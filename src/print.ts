import { symDesc } from './util'
import { isCons, listToIterable } from './Cons'
import { quoteSym, nil, isNil } from './symboltable/common-symbols'
import { SExpression, isLambdaFn, isBoostrapFn } from './SExpression'

export const printExpression = (val: SExpression): string => {
  if (typeof val === 'string') return `"${val}"`
  if (typeof val === 'number') return String(val)
  // TODO: handle special symbol names (like escaped chars)
  // clisp prints symbol names that required escaping surrounded by |
  // e.g. '\ a\ b\ c is printed as | a b c|
  if (typeof val === 'symbol') return symDesc(val) || '[Unknown Symbol]'
  if (isCons(val)) {
    // to match the printing that clisp does
    // we print as list until last cons
    // if cdr is not nil, i.e. val is an improper list
    // we print a . and then cdr
    let str = '('
    const consArr = [...listToIterable(val)]
    // special case for proper quote
    if (consArr.length === 3 && consArr[0] === quoteSym && consArr[2] === nil) {
      return `'${printExpression(consArr[1])}`
    }
    for (let i = 0; i < consArr.length; ++i) {
      const car = consArr[i]
      if (i === consArr.length - 1 && !isNil(car)) {
        // TODO: find a way to remove recursion here
        str += ` . ${printExpression(car)}`
      } else if (i === consArr.length - 1) {
        break
      } else {
        str += `${str === '(' ? '' : ' '}${printExpression(car)}`
      }
    }
    str += ')'
    return str
  }
  if (isLambdaFn(val) || isBoostrapFn(val)) return `<procedure${val.name ? ':' + val.name : ''}>`
  return val
}