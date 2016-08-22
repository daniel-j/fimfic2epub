/* global chrome */
'use strict'

import FimFic2Epub from './FimFic2Epub'
import m from 'mithril'
import { saveAs } from 'file-saver'

function blobToDataURL (blob, callback) {
  let a = new FileReader()
  a.onloadend = function (e) { callback(a.result) }
  a.readAsDataURL(blob)
}

const isChromeExt = typeof chrome !== 'undefined'

const STORY_ID = document.location.pathname.match(/^\/story\/(\d*)/)[1]

let ffc

const epubButton = document.querySelector('.story_container ul.chapters li.bottom a[title="Download Story (.epub)"]')

const dialogContainer = document.createElement('div')
dialogContainer.id = 'epubDialogContainer'
document.body.appendChild(dialogContainer)

let checkbox = {
  view: function (ctrl, args, text) {
    return m('label.toggleable-switch', [
      m('input', {type: 'checkbox', name: args.name, checked: args.checked}),
      m('a'),
      text
    ])
  }
}

let dialog = {
  controller (args) {
    this.dragging = m.prop(false)
    this.xpos = m.prop(100)
    this.ypos = m.prop(100)
    this.el = m.prop(null)
    this.ondown = (e) => {
      let el = this.el().firstChild
      let rect = el.getBoundingClientRect()
      let offset = {x: e.pageX - rect.left, y: e.pageY - rect.top}
      this.dragging(true)
      let onmove = (e) => {
        e.preventDefault()
        if (this.dragging()) {
          let rect = el.getBoundingClientRect()
          this.xpos(Math.max(0, Math.min(e.pageX - offset.x, window.innerWidth - rect.width)))
          this.ypos(Math.max(0, Math.min(e.pageY - offset.y, window.innerHeight - rect.height)))
          // console.log(e.pageX, e.pageY)
          m.redraw()
        }
      }
      let onup = () => {
        this.dragging(false)
        window.removeEventListener('mousemove', onmove)
        window.removeEventListener('mouseup', onup)
      }
      window.addEventListener('mousemove', onmove, false)
      window.addEventListener('mouseup', onup, false)
    }
  },
  view (ctrl, args, extras) {
    return m('.drop-down-pop-up-container', {config: ctrl.el, style: {left: ctrl.xpos() + 'px', top: ctrl.ypos() + 'px'}}, m('.drop-down-pop-up', [
      m('h1', {onmousedown: ctrl.ondown}, m('i.fa.fa-book'), 'Export EPUB', m('a.close_button', {onclick: closeDialog})),
      m('.drop-down-pop-up-content', [
        m(checkbox, {name: 'toggle-chapter-headings'}, 'Toggle chapter headings')
      ])
    ]))
  }
}

function openDialog (args, extras) {
  m.mount(dialogContainer, m(dialog, args, extras))
}
function closeDialog () {
  m.mount(dialogContainer, null)
}

function clickButton () {
  if (!STORY_ID) return
  if (!ffc) ffc = new FimFic2Epub(STORY_ID)

  openDialog()

  return

  ffc.download().then(ffc.getFile.bind(ffc)).then((file) => {
    console.log('Saving file...')
    if (typeof safari !== 'undefined') {
      blobToDataURL(file, (dataurl) => {
        document.location.href = dataurl
        alert('Add .epub to the filename of the downloaded file')
      })
    } else {
      saveAs(file, ffc.filename)
    }
  })
}

if (epubButton) {
  if (isChromeExt) {
    chrome.runtime.sendMessage({showPageAction: true})
    chrome.runtime.onMessage.addListener(function (request) {
      if (request === 'pageAction') {
        clickButton()
      }
    })
  }

  epubButton.addEventListener('click', function (e) {
    e.preventDefault()
    clickButton()
  }, false)
}
