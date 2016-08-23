/* global chrome, safari */

import fetch from './fetch'

if (typeof safari !== 'undefined') {
  safari.application.addEventListener('message', function (ev) {
    let url = ev.message
    fetch(url, 'arraybuffer').then((buffer) => {
      console.log('Fetched ' + url)
      ev.target.page.dispatchMessage('remote', {
        input: url,
        output: buffer
      })
    })
  }, false)
} else {
  let onMessage = chrome.extension.onMessage ? chrome.extension.onMessage : chrome.runtime.onMessage

  onMessage.addListener(function (request, sender, sendResponse) {
    if (typeof request === 'string') {
      fetch(request, 'blob').then((blob) => {
        sendResponse(URL.createObjectURL(blob))
      })
      // required for async
      return true
    } else if (request.showPageAction) {
      chrome.pageAction.show(sender.tab.id)
    }
  })

  chrome.pageAction.onClicked.addListener(function (tab) {
    chrome.tabs.sendMessage(tab.id, 'pageAction')
  })
}
