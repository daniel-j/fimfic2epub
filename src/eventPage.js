/* global chrome, safari */

import fetch from './fetch'

if (typeof safari !== 'undefined') {
  safari.application.addEventListener('message', function (ev) {
    const url = ev.message
    console.log('Fetching', url)
    fetch(url, 'arraybuffer').then((buffer) => {
      console.log('Fetched ' + url)
      ev.target.page.dispatchMessage('remote', {
        input: url,
        output: buffer
      })
    })
  }, false)
} else {
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (typeof request === 'string') {
      console.log('Fetching', request)
      fetch(request, 'blob').then((blob) => {
        const ourl = URL.createObjectURL(blob)
        console.log('Fetched', request)
        sendResponse(ourl)
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
