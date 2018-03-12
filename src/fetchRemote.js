/* global chrome, safari */

import fetch from './fetch'
import isNode from 'detect-node'

const safariQueue = {}

// messaging with the safari extension global page
function safariHandler (ev) {
  let type = ev.message.type
  let url = ev.message.input
  let data = ev.message.output // arraybuffer
  if (!safariQueue[url]) {
    // console.error("Unable to get callback for " + url, JSON.stringify(safariQueue))
    return
  }
  let cb = safariQueue[url].cb
  let responseType = safariQueue[url].responseType
  console.log(url, cb, responseType, data)
  delete safariQueue[url]

  if (responseType === 'blob') {
    let blob = new Blob([data], {type: type})
    cb(blob, type)
  } else {
    if (!responseType) {
      let blob = new Blob([data], {type: type})
      let fr = new FileReader()
      fr.onloadend = function () {
        cb(fr.result, type)
      }
      fr.readAsText(blob)
    } else {
      cb(data, type)
    }
  }
}
if (typeof safari !== 'undefined') {
  safari.self.addEventListener('message', safariHandler, false)
}

function fetchBackground (url, responseType) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(url, function (objurl) {
        resolve(fetch(objurl, responseType))
        URL.revokeObjectURL(objurl)
      })
    } else if (typeof safari !== 'undefined') {
      safariQueue[url] = {cb: resolve, responseType: responseType}
      safari.self.tab.dispatchMessage('remote', url)
    } else {
      resolve(null)
    }
  })
}

export default function fetchRemote (url, responseType) {
  if (url.startsWith('//')) {
    url = 'https:' + url
  }
  if (!isNode && document.location.protocol === 'https:' && url.startsWith('http:')) {
    return fetchBackground(url, responseType)
  }
  return fetch(url, responseType).then((data) => {
    if (!data) {
      return fetchBackground(url, responseType)
    } else {
      return Promise.resolve(data)
    }
  })
}
