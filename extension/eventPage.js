/* global chrome */
'use strict'

function fetch (url, cb, type) {
  if (url.indexOf('//') === 0) {
    url = 'http:' + url
  }
  let x = new XMLHttpRequest()
  x.open('get', url, true)
  if (type) {
    x.responseType = type
  }
  x.onload = function () {
    console.log(x.getResponseHeader('content-type'))
    cb(URL.createObjectURL(x.response), x.getResponseHeader('content-type'))
  }
  x.onerror = function () {
    console.error('error')
    cb(null)
  }
  x.send()
}

let onMessage = chrome.extension.onMessage ? chrome.extension.onMessage : chrome.runtime.onMessage

onMessage.addListener(function (request, sender, sendResponse) {
  fetch(request, sendResponse, 'blob')
  return true
})
