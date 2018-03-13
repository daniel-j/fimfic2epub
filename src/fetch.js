
import isNode from 'detect-node'

function fetchNode (url, responseType) {
  const request = require('request')
  if (url.startsWith('/')) {
    url = 'https://fimfiction.net' + url
  }
  return new Promise((resolve, reject) => {
    request({
      url: url,
      encoding: responseType ? null : 'utf8',
      headers: {
        'referer': 'https://fimfiction.net/',
        'cookie': 'view_mature=true',
        'accept': '*/*'
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
  if (url.startsWith('//')) {
    url = 'http:' + url
  }
  if (url.startsWith('/')) {
    url = 'https://fimfiction.net' + url
  }

  if (isNode) {
    return fetchNode(url, responseType)
  }
  return new Promise((resolve, reject) => {
    if (typeof window.fetch === 'function') {
      window.fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        cache: 'default',
        redirect: 'follow',
        headers: {
          'accept': '*/*' // Fix for not getting webp images from Fimfiction
        },
        referrer: window.location.origin
      }).then((response) => {
        if (responseType === 'blob') {
          response.blob().then(resolve, reject)
        } else if (responseType === 'arraybuffer') {
          response.arrayBuffer().then(resolve, reject)
        } else {
          response.text().then(resolve, reject)
        }
      }).catch((err) => {
        reject(new Error('Error fetching ' + url + ' (' + err + ')'))
      })
    } else {
      let x = new XMLHttpRequest()
      x.withCredentials = true
      x.setRequestHeader('accept', '*/*') // Fix for not getting webp images from Fimfiction
      x.open('get', url, true)
      if (responseType) {
        x.responseType = responseType
      }
      x.onload = function () {
        resolve(x.response)
      }
      x.onerror = function () {
        reject(new Error('Error fetching ' + url))
      }
      x.send()
    }
  })
}
