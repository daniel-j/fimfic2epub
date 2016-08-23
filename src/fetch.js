
import isNode from 'detect-node'

function fetchNode (url, responseType) {
  const request = require('request')
  if (url.indexOf('/') === 0) {
    url = 'http://www.fimfiction.net' + url
  }
  return new Promise((resolve, reject) => {
    request({
      url: url,
      encoding: responseType ? null : 'utf8',
      headers: {
        referer: 'http://www.fimfiction.net/',
        cookie: 'view_mature=true'
      }
    }, (error, response, body) => {
      if (error) {
        reject(error)
        return
      }
      // let type = response.headers['content-type']
      resolve(body)
    })
  })
}

export default function fetch (url, responseType) {
  if (url.indexOf('//') === 0) {
    url = 'http:' + url
  }

  if (isNode) {
    return fetchNode(url, responseType)
  }
  return new Promise((resolve, reject) => {
    let x = new XMLHttpRequest()
    x.open('get', url, true)
    if (responseType) {
      x.responseType = responseType
    }
    x.onload = function () {
      // x.getResponseHeader('content-type')
      resolve(x.response)
    }
    x.onerror = function () {
      reject('Error fetching ' + url)
    }
    x.send()
  })
}
