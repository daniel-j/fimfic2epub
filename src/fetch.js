
import isNode from 'detect-node'

function fetchNode (url, cb, responseType) {
  const request = require('request')
  request({
    url: url,
    encoding: responseType ? null : 'utf8',
    headers: {
      referer: 'http://www.fimfiction.net/',
      cookie: 'view_mature=true'
    }
  }, (error, response, body) => {
    if (error) {
      console.error(error)
      cb()
      return
    }
    let type = response.headers['content-type']
    cb(body, type)
  })
}

export default function fetch (url, cb, responseType) {
  if (url.indexOf('//') === 0) {
    url = 'http:' + url
  }

  if (isNode) {
    fetchNode(url, cb, responseType)
    return
  }

  let x = new XMLHttpRequest()
  x.open('get', url, true)
  if (responseType) {
    x.responseType = responseType
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
