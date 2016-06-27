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

function fetchBackground (url, cb, responseType) {
  if (typeof chrome !== 'undefined' && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage(url, function (objurl) {
      fetch(objurl, cb, responseType)
      URL.revokeObjectURL(objurl)
    })
  } else {
    safariQueue[url] = {cb: cb, responseType: responseType}
    safari.self.tab.dispatchMessage('remote', url)
  }
}

export default function fetchRemote (url, cb, responseType) {
  if (url.indexOf('//') === 0) {
    url = 'http:' + url
  }
  if (isNode) {
    fetchNode(url, cb, responseType)
    return
  }
  if (document.location.protocol === 'https:' && url.indexOf('http:') === 0) {
    fetchBackground(url, cb, responseType)
    return
  }
  fetch(url, (data, type) => {
    if (!data) {
      fetchBackground(url, cb, responseType)
    } else {
      cb(data, type)
    }
  }, responseType)
}

function fetchNode (url, cb, responseType) {
  process.request({
    url: url,
    encoding: responseType ? null : 'utf8'
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
