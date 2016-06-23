/* global chrome, safari */

import fetch from './fetch'

if (typeof safari !== 'undefined') {
  safari.application.addEventListener('message', function (ev) {
    let url = ev.message
    fetch(url, (buffer, type) => {
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
    fetch(request, (blob, type) => {
      sendResponse(URL.createObjectURL(blob), type)
    }, 'blob')
    return true
  })
}
