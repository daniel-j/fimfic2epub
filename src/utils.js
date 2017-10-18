
export function replaceAsync (str, re, callback) {
  // http://es5.github.io/#x15.5.4.11
  str = String(str)
  let parts = []
  let i = 0
  if (Object.prototype.toString.call(re) === '[object RegExp]') {
    if (re.global) { re.lastIndex = i }
    let m
    while ((m = re.exec(str))) {
      let args = m.concat([m.index, m.input])
      parts.push(str.slice(i, m.index), callback.apply(null, args))
      i = re.lastIndex
      if (!re.global) { break } // for non-global regexes only take the first match
      if (m[0].length === 0) { re.lastIndex++ }
    }
  } else {
    re = String(re)
    i = str.indexOf(re)
    parts.push(str.slice(0, i), callback(re, i, str))
    i += re.length
  }
  parts.push(str.slice(i))
  return Promise.all(parts).then(function (strings) {
    return strings.join('')
  })
}
