/* global chrome, safari */

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
    cb(x.response, x.getResponseHeader('content-type'))
  }
  x.onerror = function () {
    console.error('error')
    cb(null)
  }
  x.send()
}

if (typeof safari !== 'undefined') {
  safari.application.addEventListener('message', function (ev) {
    let url = ev.message
    fetch(url, function (buffer, type) {
      console.log('Fetched ' + url + ' (' + type + ')')
      ev.target.page.dispatchMessage('remote', {
        input: url,
        output: buffer,
        type: type
      })
    }, 'arraybuffer')
  }, false)
} else {
  let onMessage = chrome.extension.onMessage ? chrome.extension.onMessage : chrome.runtime.onMessage

  onMessage.addListener(function (request, sender, sendResponse) {
    fetch(request, function (blob, type) {
      sendResponse(URL.createObjectURL(blob), type)
    }, 'blob')
    return true
  })
}
