
import isNode from 'detect-node'

function fetchNode (url, responseType) {
  const fetch = require('node-fetch').default
  if (url.startsWith('/')) {
    url = 'https://www.fimfiction.net' + url
  }
  return fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'include',
    cache: 'default',
    redirect: 'follow',
    headers: {
      cookie: 'view_mature=true',
      referer: 'https://www.fimfiction.net/',
      accept: 'Accept: text/*, image/png, image/jpeg' // Fix for not getting webp images from Fimfiction
    }
  }).then((response) => {
    if (responseType) {
      return response.buffer()
    } else {
      return response.text()
    }
  })
}

export default function fetch (url, responseType) {
  if (url.startsWith('//')) {
    url = 'http:' + url
  }

  if (isNode) {
    return fetchNode(url, responseType)
  }
  if (url.startsWith('/')) {
    url = window.location.origin + url
  }
  return new Promise((resolve, reject) => {
    if (typeof window.fetch === 'function') {
      window.fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        cache: 'default',
        headers: {
          accept: 'Accept: text/*, image/png, image/jpeg' // Fix for not getting webp images from Fimfiction
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
      const x = new XMLHttpRequest()
      x.withCredentials = true
      x.setRequestHeader('accept', 'text/*, image/png, image/jpeg') // Fix for not getting webp images from Fimfiction
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
