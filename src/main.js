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
    this.xpos = m.prop(0)
    this.ypos = m.prop(0)
    this.el = m.prop(null)
    this.progress = m.prop(0)
    this.ondown = (e) => {
      let rect = this.el().firstChild.getBoundingClientRect()
      let offset = {x: e.pageX - rect.left - document.body.scrollLeft, y: e.pageY - rect.top - document.body.scrollTop}
      this.dragging(true)
      let onmove = (e) => {
        e.preventDefault()
        if (this.dragging()) {
          this.xpos(Math.max(0, e.pageX - offset.x))
          this.ypos(Math.max(0, e.pageY - offset.y))
          this.move()
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
    this.onOpen = function (el, first) {
      if (!first) {
        this.el(el)
        let rect = this.el().firstChild.getBoundingClientRect()
        this.xpos((window.innerWidth / 2) - (rect.width / 2) + document.body.scrollLeft)
        this.ypos((window.innerHeight / 2) - (rect.height / 2) + document.body.scrollTop)
        this.move()
      }
    }
    this.move = () => {
      this.el().style.left = this.xpos() + 'px'
      this.el().style.top = this.ypos() + 'px'
    }
    this.createEpub = (e) => {
      e.target.disabled = true
      ffc.fetch()
        .then(ffc.build.bind(ffc))
        .then(ffc.getFile.bind(ffc)).then((file) => {
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
  },
  view (ctrl, args, extras) {
    return m('.drop-down-pop-up-container', {config: ctrl.onOpen.bind(ctrl)}, m('.drop-down-pop-up', [
      m('h1', {onmousedown: ctrl.ondown}, m('i.fa.fa-book'), 'Export to EPUB', m('a.close_button', {onclick: closeDialog})),
      m('.drop-down-pop-up-content', [
        m('table.properties', [
          m('tr', m('td.label', 'Cover image'), m('td', 'some config')),
          m('tr', m('td.label', 'Chapter headings'), m('td', m(checkbox, {name: 'toggle-chapter-headings'})))
        ]),
        m('.drop-down-pop-up-footer', [
          m('button.styled_button', {onclick: ctrl.createEpub}, 'Create EPUB'),
          ctrl.progress() > 0 ? m('.rating_container', m('.bars_container', m('.bar_container', m('.bar_dislike', m('.bar.bar_like', {style: {width: ctrl.progress() * 100 + '%'}}))))) : null
        ])
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
