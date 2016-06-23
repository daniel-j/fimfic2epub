
export default function fetch (url, cb, type) {
  if (url.indexOf('//') === 0) {
    url = 'http:' + url
  }
  let x = new XMLHttpRequest()
  x.open('get', url, true)
  if (type) {
    x.responseType = type
  }
  x.onload = function () {
    cb(x.response, x.getResponseHeader('content-type'))
  }
  x.onerror = function () {
    console.error('error')
    cb(null)
  }
  x.send()
}
