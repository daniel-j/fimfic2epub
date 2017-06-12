/* global chrome */
'use strict'

import FimFic2Epub from './FimFic2Epub'
import m from 'mithril'
import { saveAs } from 'file-saver'
import autosize from 'autosize'

function blobToDataURL (blob) {
  return new Promise((resolve, reject) => {
    let fr = new FileReader()
    fr.onloadend = function (e) { resolve(fr.result) }
    fr.readAsDataURL(blob)
  })
}

function blobToArrayBuffer (blob) {
  return new Promise((resolve, reject) => {
    let fr = new FileReader()
    fr.onloadend = function (e) { resolve(fr.result) }
    fr.readAsArrayBuffer(blob)
  })
}

const isChromeExt = typeof chrome !== 'undefined'

let pageStoryId
try {
  pageStoryId = document.location.pathname.match(/^\/story\/(\d*)/)[1]
} catch (e) {}

let logoUrl = chrome.extension.getURL('fimfic2epub-logo.png')

let ffc

let stories = document.querySelectorAll('.story_container')

stories.forEach((story) => {
  let id = story.dataset.story
  function epubClick (e) {
    e.preventDefault()
    openStory(id)
  }

  let epubButtons = story.querySelectorAll('.drop-down ul li a[title="Download Story (.epub)"]')
  if (epubButtons.length === 0) return
  for (let i = 0; i < epubButtons.length; i++) {
    epubButtons[i].addEventListener('click', epubClick, false)
  }
  let logo = new Image()
  logo.className = 'fimfic2epub-logo'
  logo.title = 'Download EPUB with fimfic2epub'
  logo.src = logoUrl
  story.querySelector('.story_content_box .title').appendChild(logo)
  logo.addEventListener('click', epubClick, false)
})

let cards = document.querySelectorAll('.story-card-container')
cards.forEach((card) => {
  let id
  let classes = card.className.split(' ')
  for (let i = 0; i < classes.length && !id; i++) {
    let c = classes[i]
    id = c.substring(21)
  }
  if (!id) return
  let flip = card.querySelector('a.card-flip')
  let epubButton = card.querySelector('a[title="Download .ePub"]')
  if (!epubButton) return
  epubButton.addEventListener('click', function (e) {
    e.preventDefault()
    openStory(id)
    flip.click()
  }, false)
})

const dialogContainer = document.createElement('div')
dialogContainer.id = 'epubDialogContainer'
document.body.appendChild(dialogContainer)

let checkbox = {
  view: function (ctrl, args, text) {
    return m('label.toggleable-switch', [
      m('input', Object.assign({
        type: 'checkbox'
      }, args)),
      m('a'),
      text ? m('span', text) : null
    ])
  }
}

function selectOptions (list, selected = '') {
  return list.map((item) => {
    return m('option', {
      value: item[0],
      selected: selected === item[0]
    }, item[1])
  })
}

function redraw (arg) {
  try {
    m.redraw(arg)
  } catch (err) {
    console.log(err)
  }
}

let ffcProgress = m.prop(0)
let ffcStatus = m.prop('')

let dialog = {
  controller (args) {
    const ctrl = this

    ffcProgress(0)

    this.isLoading = m.prop(true)
    this.dragging = m.prop(false)
    this.xpos = m.prop(0)
    this.ypos = m.prop(0)
    this.el = m.prop(null)
    this.coverFile = m.prop(null)
    this.coverUrl = m.prop('')
    this.checkboxCoverUrl = m.prop(false)

    this.title = m.prop('')
    this.author = m.prop('')
    this.description = m.prop('')
    this.subjects = m.prop([])
    this.addCommentsLink = m.prop(ffc.options.addCommentsLink)
    this.includeAuthorNotes = m.prop(ffc.options.includeAuthorNotes)
    this.useAuthorNotesIndex = m.prop(ffc.options.useAuthorNotesIndex)
    this.addChapterHeadings = m.prop(ffc.options.addChapterHeadings)
    this.includeExternal = m.prop(ffc.options.includeExternal)
    this.joinSubjects = m.prop(ffc.options.joinSubjects)
    this.paragraphStyle = m.prop(ffc.options.paragraphStyle)

    this.onOpen = function (el, isInitialized) {
      if (!isInitialized) {
        this.el(el)
        this.center()
        this.isLoading(true)
        ffc.fetchMetadata().then(() => {
          this.isLoading(false)
          ffcProgress(-1)
          this.title(ffc.storyInfo.title)
          this.author(ffc.storyInfo.author.name)
          this.description(ffc.storyInfo.short_description)
          this.subjects(ffc.subjects.slice(0))
          redraw(true)
          this.center()
          ffc.fetchChapters().then(() => {
            ffcProgress(-1)
            redraw()
          })
        }).catch((err) => {
          throw err
        })
      }
    }

    this.setCoverFile = (e) => {
      this.coverFile(e.target.files ? e.target.files[0] : null)
    }

    this.setSubjects = function () {
      // 'this' is the textarea
      let set = new Set()
      ctrl.subjects(this.value.split('\n').map((s) => s.trim()).filter((s) => {
        if (!s) return false
        if (set.has(s)) return false
        set.add(s)
        return true
      }))
      this.value = ctrl.subjects().join('\n')
      autosize.update(this)
    }

    this.setDescription = function () {
      ctrl.description(this.value.trim())
      this.value = ctrl.description()
      autosize.update(this)
    }

    this.ondown = (e) => {
      let rect = this.el().firstChild.getBoundingClientRect()
      let offset = {x: e.pageX - rect.left - document.body.scrollLeft, y: e.pageY - rect.top - document.body.scrollTop}
      this.dragging(true)
      let onmove = (e) => {
        e.preventDefault()
        if (this.dragging()) {
          this.move(e.pageX - offset.x, e.pageY - offset.y)
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

    this.move = (xpos, ypos) => {
      let bc = document.querySelector('.body_container')
      let rect = this.el().firstChild.getBoundingClientRect()
      this.xpos(Math.max(0, Math.min(xpos, bc.offsetWidth - rect.width)))
      this.ypos(Math.max(0, Math.min(ypos, bc.offsetHeight - rect.height)))
      this.el().style.left = this.xpos() + 'px'
      this.el().style.top = this.ypos() + 'px'
    }
    this.center = () => {
      if (this.dragging()) return
      let rect = this.el().firstChild.getBoundingClientRect()
      this.move(
        Math.max(document.body.scrollLeft, (window.innerWidth / 2) - (rect.width / 2) + document.body.scrollLeft),
        Math.max(document.body.scrollTop, (window.innerHeight / 2) - (rect.height / 2) + document.body.scrollTop)
      )
    }

    this.createEpub = (e) => {
      ffcProgress(0)
      ffcStatus('')
      e.target.disabled = true
      let chain = Promise.resolve()
      ffc.coverUrl = ''
      ffc.coverImage = null
      if (this.checkboxCoverUrl()) {
        ffc.coverUrl = this.coverUrl()
      } else if (this.coverFile()) {
        chain = chain.then(blobToArrayBuffer.bind(null, this.coverFile())).then(ffc.setCoverImage.bind(ffc))
      }
      ffc.setTitle(this.title())
      ffc.setAuthorName(this.author())
      ffc.storyInfo.short_description = this.description()
      ffc.options.addCommentsLink = this.addCommentsLink()
      ffc.options.includeAuthorNotes = this.includeAuthorNotes()
      ffc.options.useAuthorNotesIndex = this.useAuthorNotesIndex()
      ffc.options.addChapterHeadings = this.addChapterHeadings()
      ffc.options.includeExternal = this.includeExternal()
      ffc.options.paragraphStyle = this.paragraphStyle()
      ffc.subjects = this.subjects()
      ffc.options.joinSubjects = this.joinSubjects()
      redraw()

      chain
        .then(ffc.fetchAll.bind(ffc))
        .then(ffc.build.bind(ffc))
        .then(ffc.getFile.bind(ffc)).then((file) => {
          if (typeof safari !== 'undefined') {
            blobToDataURL(file).then((dataurl) => {
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
    return m('.drop-down-pop-up-container', {config: ctrl.onOpen.bind(ctrl)}, m('.drop-down-pop-up', {style: {'min-width': '700px'}}, [
      m('h1', {onmousedown: ctrl.ondown}, m('i.fa.fa-book'), 'Export to EPUB', m('a.close_button', {onclick: closeDialog})),
      m('.drop-down-pop-up-content', [
        ctrl.isLoading() ? m('div', {style: 'text-align:center;'}, m('i.fa.fa-spin.fa-spinner', {style: 'font-size:50px; margin:20px; color:#777;'})) : m('table.properties', [
          m('tr', m('td.section_header', {colspan: 3}, m('b', 'General settings'))),
          m('tr', m('td.label', 'Title'), m('td', {colspan: 2}, m('input', {type: 'text', value: ctrl.title(), onchange: m.withAttr('value', ctrl.title)}))),
          m('tr', m('td.label', 'Author'), m('td', {colspan: 2}, m('input', {type: 'text', value: ctrl.author(), onchange: m.withAttr('value', ctrl.author)}))),
          m('tr', m('td.label', 'Custom cover image'),
            m('td',
              ctrl.checkboxCoverUrl() ? m('input', {type: 'url', placeholder: 'Image URL', onchange: m.withAttr('value', ctrl.coverUrl)}) : m('input', {type: 'file', accept: 'image/*', onchange: ctrl.setCoverFile})
            ),
            m('td', {style: 'width: 1px'}, m(checkbox, {checked: ctrl.checkboxCoverUrl(), onchange: m.withAttr('checked', ctrl.checkboxCoverUrl)}, 'Use image URL'))
          ),
          m('tr', m('td.label', 'Paragraph style'), m('td', {colspan: 2},
            m('select', {onchange: m.withAttr('value', ctrl.paragraphStyle)}, selectOptions([
              ['indented', 'Indent first line in all paragraphs except the first (Traditional Paperback)'],
              ['spaced', 'Separate each paragraph with double space (Traditional Web)'],
              ['both', 'Double space and indent all paragraphs except first (Fusion)'],
              ['indentedall', 'Indent all paragraphs including the first (Modified Traditional)']
            ], ctrl.paragraphStyle()))
          )),
          m('tr', m('td.label', ''), m('td', {colspan: 2},
            m(checkbox, {checked: ctrl.addChapterHeadings(), onchange: m.withAttr('checked', ctrl.addChapterHeadings)}, 'Add chapter headings'),
            m(checkbox, {checked: ctrl.addCommentsLink(), onchange: m.withAttr('checked', ctrl.addCommentsLink)}, 'Add link to online comments (at the end of chapters)'),
            m(checkbox, {checked: ctrl.includeAuthorNotes(), onchange: m.withAttr('checked', ctrl.includeAuthorNotes)}, 'Include author\'s notes'),
            m(checkbox, {checked: ctrl.useAuthorNotesIndex(), onchange: m.withAttr('checked', ctrl.useAuthorNotesIndex), disabled: !ctrl.includeAuthorNotes()}, 'Put all notes at the end of the ebook'),
            m(checkbox, {checked: ctrl.includeExternal(), onchange: m.withAttr('checked', ctrl.includeExternal)}, 'Download & include remote content (embed images)'),
            m('div', {style: 'font-size: 0.9em; line-height: 1em; margin-top: 4px; margin-bottom: 6px; color: #777;'}, 'Note: Disabling this creates invalid EPUBs and requires internet access to see remote content. Only cover image will be embedded.')
          )),

          m('tr', m('td.section_header', {colspan: 3}, m('b', 'Metadata customization'))),
          m('tr', m('td.label', {style: 'vertical-align: top;'}, 'Description'), m('td', {colspan: 2}, m('textarea', {config: autosize, onchange: ctrl.setDescription}, ctrl.description()))),
          m('tr', m('td.label', {style: 'vertical-align: top;'}, 'Categories'), m('td', {colspan: 2},
            m('textarea', {rows: 2, config: autosize, onchange: ctrl.setSubjects}, ctrl.subjects().join('\n')),
            m(checkbox, {checked: ctrl.joinSubjects(), onchange: m.withAttr('checked', ctrl.joinSubjects)}, 'Join categories and separate with commas (for iBooks only)')
          ))
        ]),
        m('.drop-down-pop-up-footer', [
          m('button.styled_button', {onclick: ctrl.createEpub, disabled: ffcProgress() >= 0 && ffcProgress() < 1, style: 'float: right'}, 'Download EPUB'),
          ffcProgress() >= 0 ? m('.rating_container',
            m('.rating-bar', {style: {background: 'rgba(0, 0, 0, 0.2)', 'margin-right': '5px'}}, m('.like-bar', {style: {width: Math.max(0, ffcProgress()) * 100 + '%'}})),
            ' ',
            ffcProgress() >= 0 && ffcProgress() < 1 ? [ m('i.fa.fa-spin.fa-spinner'), m.trust('&nbsp;&nbsp;') ] : null,
            ffcStatus()
          ) : null,
          m('div', {style: 'clear: both'})
        ])
      ])
    ]))
  }
}

let dialogOpen = false
function openDialog (args, extras) {
  if (dialogOpen) {
    return
  }
  dialogOpen = true
  m.mount(dialogContainer, m(dialog, args, extras))
}
function closeDialog () {
  dialogOpen = false
  m.mount(dialogContainer, null)
}

function openStory (id) {
  if (!ffc) {
    ffc = new FimFic2Epub(id)
    ffc.on('progress', onProgress)
  } else if (ffc.storyId !== id) {
    ffc.off('progress', onProgress)
    closeDialog()
    ffc = new FimFic2Epub(id)
    ffc.on('progress', onProgress)
  } else {

  }

  openDialog()
}

function onProgress (percent, status) {
  ffcProgress(percent)
  if (status) {
    ffcStatus(status)
  }
  redraw()
}

if (pageStoryId && isChromeExt) {
  chrome.runtime.sendMessage({showPageAction: true})
  chrome.runtime.onMessage.addListener(function (request) {
    if (request === 'pageAction') {
      openStory(pageStoryId)
    }
  })
}
