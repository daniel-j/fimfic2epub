/* global chrome */
'use strict'

import FimFic2Epub from './FimFic2Epub'
import m from 'mithril'
import prop from 'mithril/stream'
import { saveAs } from 'file-saver'
import autosize from 'autosize'
import { htmlToText } from './utils'

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
  view: function ({attrs, children}) {
    return m('label.toggleable-switch', [
      m('input', Object.assign({
        type: 'checkbox'
      }, attrs)),
      m('a'),
      children ? m('span', children) : null
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

let ffcProgress = prop(0)
let ffcStatus = prop('')

let dialog = {
  oninit () {
    const ctrl = this

    ffcProgress(0)

    this.isLoading = prop(true)
    this.dragging = prop(false)
    this.xpos = prop(0)
    this.ypos = prop(0)
    this.el = prop(null)
    this.coverFile = prop(null)
    this.coverUrl = prop('')
    this.checkboxCoverUrl = prop(false)

    this.title = prop('')
    this.author = prop('')
    this.description = prop('')
    this.subjects = prop([])
    this.typogrify = prop(ffc.options.typogrify)
    this.addCommentsLink = prop(ffc.options.addCommentsLink)
    this.includeAuthorNotes = prop(ffc.options.includeAuthorNotes)
    this.useAuthorNotesIndex = prop(ffc.options.useAuthorNotesIndex)
    this.showChapterHeadings = prop(ffc.options.showChapterHeadings)
    this.showChapterWordCount = prop(ffc.options.showChapterWordCount)
    this.showChapterDuration = prop(ffc.options.showChapterDuration)
    this.includeExternal = prop(ffc.options.includeExternal)
    this.kepubify = prop(ffc.options.kepubify)
    this.joinSubjects = prop(ffc.options.joinSubjects)
    this.paragraphStyle = prop(ffc.options.paragraphStyle)
    this.calculateReadingEase = prop(ffc.options.calculateReadingEase)
    this.addChapterBars = prop(ffc.options.addChapterBars)
    this.wordsPerMinute = prop(ffc.options.wordsPerMinute)

    this.onOpen = (vnode) => {
      this.el(vnode.dom)
      this.center()
      this.isLoading(true)
      ffc.fetchMetadata().then(() => {
        this.isLoading(false)
        ffcProgress(-1)
        this.title(ffc.storyInfo.title)
        this.author(ffc.storyInfo.author.name)
        this.description(htmlToText(ffc.storyInfo.description) || ffc.storyInfo.short_description)
        this.subjects(ffc.subjects.slice(0))
        redraw(true)
        // this.center()
        ffc.fetchChapters().then(() => {
          ffcProgress(-1)
          redraw()
        })
      }).catch((err) => {
        console.error(err)
      })
    }

    this.setCoverFile = (e) => {
      let el = e.dom || e.target
      if (el.target) {
        this.coverUrl('')
      }
      this.coverFile(el.files ? el.files[0] : null)
      console.log('files:', el.files)
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
      let offset = {x: e.pageX - rect.left - document.documentElement.scrollLeft, y: e.pageY - rect.top - document.documentElement.scrollTop}
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
        Math.max(document.documentElement.scrollLeft, (window.innerWidth / 2) - (rect.width / 2) + document.documentElement.scrollLeft),
        Math.max(document.documentElement.scrollTop, 100 + document.documentElement.scrollTop)
      )
    }

    this.createEpub = (e) => {
      e.target.disabled = true
      createEpub(this)
    }
  },

  view (vnode) {
    let ctrl = vnode.state
    return m('.drop-down-pop-up-container', {oncreate: ctrl.onOpen.bind(ctrl)}, m('.drop-down-pop-up', {style: {'min-width': '720px'}}, [
      m('h1', {onmousedown: ctrl.ondown}, m('i.fa.fa-book'), 'Export to EPUB (v' + FIMFIC2EPUB_VERSION + ')', m('a.close_button', {onclick: closeDialog})),
      m('.drop-down-pop-up-content', [
        ctrl.isLoading() ? m('div', {style: 'text-align:center;'}, m('i.fa.fa-spin.fa-spinner', {style: 'font-size:50px; margin:20px; color:#777;'})) : m('table.properties', [
          m('tr', m('td.section_header', {colspan: 3}, m('b', 'General settings'))),
          m('tr', m('td.label', 'Title'), m('td', {colspan: 2}, m('input', {type: 'text', value: ctrl.title(), onchange: m.withAttr('value', ctrl.title)}))),
          m('tr', m('td.label', 'Author'), m('td', {colspan: 2}, m('input', {type: 'text', value: ctrl.author(), onchange: m.withAttr('value', ctrl.author)}))),
          m('tr', m('td.label', 'Custom cover image'),
            m('td',
              ctrl.checkboxCoverUrl() ? m('input', {type: 'url', placeholder: 'Image URL', onchange: m.withAttr('value', ctrl.coverUrl)}) : m('input', {type: 'file', accept: 'image/*', onchange: ctrl.setCoverFile, onupdate: ctrl.setCoverFile})
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
          m('tr', m('td.label', {style: 'vertical-align: top;'}, 'Options'), m('td', {colspan: 2},
            m(checkbox, {checked: ctrl.typogrify(), onchange: m.withAttr('checked', ctrl.typogrify)}, 'Apply typographic fixes (smart quotes, dashes etc.)'),
            m(checkbox, {checked: ctrl.showChapterHeadings(), onchange: m.withAttr('checked', ctrl.showChapterHeadings)}, 'Add chapter headings'),
            m(checkbox, {checked: ctrl.showChapterWordCount(), onchange: m.withAttr('checked', ctrl.showChapterWordCount), disabled: !ctrl.showChapterHeadings()}, 'Include word count in chapter heading'),
            m(checkbox, {checked: ctrl.showChapterDuration(), onchange: m.withAttr('checked', ctrl.showChapterDuration), disabled: !ctrl.showChapterHeadings()}, 'Include time to read in chapter heading'),
            m(checkbox, {checked: ctrl.addCommentsLink(), onchange: m.withAttr('checked', ctrl.addCommentsLink)}, 'Add link to online comments (at the end of chapters)'),
            m(checkbox, {checked: ctrl.includeAuthorNotes(), onchange: m.withAttr('checked', ctrl.includeAuthorNotes)}, 'Include author\'s notes'),
            m(checkbox, {checked: ctrl.useAuthorNotesIndex(), onchange: m.withAttr('checked', ctrl.useAuthorNotesIndex), disabled: !ctrl.includeAuthorNotes()}, 'Put all notes at the end of the ebook'),
            m(checkbox, {checked: ctrl.calculateReadingEase(), onchange: m.withAttr('checked', ctrl.calculateReadingEase)}, 'Calculate Flesch reading ease'),
            m(checkbox, {checked: ctrl.addChapterBars(), onchange: m.withAttr('checked', ctrl.addChapterBars)}, 'Show reading progress and chapter lengths as bars'),
            m(checkbox, {checked: ctrl.includeExternal(), onchange: m.withAttr('checked', ctrl.includeExternal)}, 'Download & include remote content (embed images)'),
            m('div', {style: 'font-size: 0.9em; line-height: 1em; margin-top: 4px; margin-bottom: 6px; opacity: 0.6;'}, 'Note: Disabling this creates invalid EPUBs and requires internet access to see remote content. Only cover image will be embedded.'),
            m(checkbox, {checked: ctrl.kepubify(), onchange: m.withAttr('checked', ctrl.kepubify)}, 'Export as Kobo EPUB, this adds some Kobo-specific div/span tags.')
          )),
          m('tr', m('td.label', 'Words per minute'), m('td', {colspan: 2},
            m('input', {type: 'number', min: 0, step: 1, value: ctrl.wordsPerMinute(), onchange: m.withAttr('value', ctrl.wordsPerMinute), placeholder: '200 (default)', style: {width: '140px', float: 'left', marginRight: '.75rem', marginTop: '.35rem', position: 'relative', zIndex: 1}}),
            m('div', {style: 'font-size: 0.9em; line-height: 1em; margin-top: 4px; margin-bottom: 6px; opacity: 0.6;'}, 'This is used to estimate the time it takes to read the story. Take a test to find out your reading speed.', m('br'), 'Set to 0 to disable.')
          )),

          m('tr', m('td.section_header', {colspan: 3}, m('b', 'Metadata customization'))),
          m('tr', m('td.label', {style: 'vertical-align: top;'}, 'Description'), m('td', {colspan: 2}, m('textarea', {oncreate: ({dom}) => autosize(dom), onchange: ctrl.setDescription}, ctrl.description()))),
          m('tr', m('td.label', {style: 'vertical-align: top;'}, 'Categories'), m('td', {colspan: 2},
            m('textarea', {rows: 2, oncreate: ({dom}) => autosize(dom), onchange: ctrl.setSubjects}, ctrl.subjects().join('\n')),
            m(checkbox, {checked: ctrl.joinSubjects(), onchange: m.withAttr('checked', ctrl.joinSubjects)}, 'Join categories and separate with commas')
          ))
        ]),
        m('.drop-down-pop-up-footer', [
          m('button.styled_button', {onclick: ctrl.createEpub, disabled: ffcProgress() >= 0 && ffcProgress() < 1, style: 'float: right'}, 'Download ' + (ctrl.kepubify() ? 'Kobo EPUB' : 'EPUB')),
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
function openDialog () {
  if (dialogOpen) {
    return
  }
  dialogOpen = true
  m.mount(dialogContainer, dialog)
}
function closeDialog () {
  dialogOpen = false
  m.mount(dialogContainer, null)
}

function createEpub (model) {
  ffcProgress(0)
  ffcStatus('')
  let chain = Promise.resolve()
  ffc.coverUrl = ''
  ffc.coverImage = null
  if (model.checkboxCoverUrl()) {
    ffc.coverUrl = model.coverUrl()
  } else if (model.coverFile()) {
    chain = chain
      .then(() => blobToArrayBuffer(model.coverFile()))
      .then((buf) => {
        ffc.setCoverImage(buf)
      }).catch((err) => console.error(err))
  }

  ffc.setTitle(model.title())
  ffc.setAuthorName(model.author())
  ffc.storyInfo.short_description = model.description()
  ffc.options.typogrify = model.typogrify()
  ffc.options.addCommentsLink = model.addCommentsLink()
  ffc.options.includeAuthorNotes = model.includeAuthorNotes()
  ffc.options.useAuthorNotesIndex = model.useAuthorNotesIndex()
  ffc.options.showChapterHeadings = model.showChapterHeadings()
  ffc.options.showChapterWordCount = model.showChapterWordCount()
  ffc.options.showChapterDuration = model.showChapterDuration()
  ffc.options.includeExternal = model.includeExternal()
  ffc.options.paragraphStyle = model.paragraphStyle()
  ffc.options.kepubify = model.kepubify()
  ffc.subjects = model.subjects()
  ffc.options.joinSubjects = model.joinSubjects()
  ffc.options.calculateReadingEase = model.calculateReadingEase()
  ffc.options.addChapterBars = model.addChapterBars()
  if (model.wordsPerMinute() === '') ffc.options.wordsPerMinute = 200
  else ffc.options.wordsPerMinute = parseInt(model.wordsPerMinute(), 10) || 0
  model.wordsPerMinute(ffc.options.wordsPerMinute)
  redraw()

  chrome.storage.sync.set({ffcOptions: ffc.options, version: FIMFIC2EPUB_VERSION})

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
        let filename = ffc.filename
        if (ffc.options.kepubify) {
          filename = filename.replace(/\.epub$/, '.kepub.epub')
        }
        saveAs(file, filename)
      }
    })
}

function openStory (id) {
  chrome.storage.sync.get(['ffcOptions', 'version'], function (result) {
    let options = result.ffcOptions
    // Reset options on new version
    if (result.version !== FIMFIC2EPUB_VERSION) {
      options = {}
    }

    if (!ffc) {
      ffc = new FimFic2Epub(id, options)
      ffc.on('progress', onProgress)
    } else if (ffc.storyId !== id) {
      ffc.off('progress', onProgress)
      closeDialog()
      ffc = new FimFic2Epub(id, options)
      ffc.on('progress', onProgress)
    }
    openDialog()
  })
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
