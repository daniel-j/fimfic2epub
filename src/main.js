/* global chrome, safari */

import JSZip from 'jszip'
import escapeStringRegexp from 'escape-string-regexp'
import { saveAs } from 'file-saver'
import zeroFill from 'zero-fill'

import styleCss from './style'
import coverstyleCss from './coverstyle'

import fetch from './fetch'
import parseChapter from './parseChapter'
import * as template from './templates'
import { mimeMap, containerXml } from './constants'

const STORY_ID = document.location.pathname.match(/^\/story\/(\d*)/)[1]

let storyInfo
let remoteResources = new Map()
let chapterContent = []
let safariQueue = {}

let epubButton = document.querySelector('.story_container ul.chapters li.bottom a[title="Download Story (.epub)"]')
let isDownloading = false
let cachedBlob = null

if (epubButton) {
  epubButton.addEventListener('click', function (e) {
    e.preventDefault()
    if (isDownloading) {
      alert("Calm down, I'm working on it (it's processing)")
      return
    }
    if (cachedBlob) {
      saveStory()
      return
    }
    downloadStory()
  }, false)
}

function blobToDataURL (blob, callback) {
  let a = new FileReader()
  a.onloadend = function (e) { callback(a.result) }
  a.readAsDataURL(blob)
}

function saveStory () {
  console.log('Saving epub...')
  if (typeof safari !== 'undefined') {
    blobToDataURL(cachedBlob, (dataurl) => {
      document.location.href = dataurl
      alert('Rename downloaded file to .epub')
    })
  } else {
    saveAs(cachedBlob, storyInfo.title + ' by ' + storyInfo.author.name + '.epub')
  }
}

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

function fetchRemote (url, cb, responseType) {
  if (url.indexOf('//') === 0) {
    url = 'http:' + url
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

function fetchRemoteFiles (zip, cb) {
  let iter = remoteResources.entries()
  let counter = 0

  function recursive () {
    let r = iter.next().value
    if (!r) {
      cb()
      return
    }
    let url = r[0]
    r = r[1]
    console.log('Fetching remote file ' + (counter + 1) + ' of ' + remoteResources.size + ': ' + r.filename, url)
    fetchRemote(url, (data, type) => {
      r.dest = null
      r.type = type
      let dest = mimeMap[type]

      if (dest) {
        r.dest = dest.replace('*', r.filename)
        zip.file(r.dest, data)
      }
      counter++
      recursive()
    }, 'arraybuffer')
  }
  recursive()
}

function fetchChapters (cb) {
  let chapters = storyInfo.chapters
  let chapterCount = storyInfo.chapters.length
  let currentChapter = 0
  function recursive () {
    let ch = chapters[currentChapter]
    console.log('Fetching chapter ' + (currentChapter + 1) + ' of ' + chapters.length + ': ' + ch.title)
    fetchRemote(ch.link.replace('http', 'https'), (html) => {
      parseChapter(currentChapter, ch, html, remoteResources, (html) => {
        chapterContent[currentChapter] = html
        currentChapter++
        if (currentChapter < chapterCount) {
          recursive()
        } else {
          cb()
        }
      })
    })
  }
  recursive()
}

function downloadStory () {
  isDownloading = true

  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip')
  zip.folder('META-INF').file('container.xml', containerXml)

  console.log('Fetching story metadata...')

  fetchRemote('https://www.fimfiction.net/api/story.php?story=' + STORY_ID, (raw, type) => {
    let data
    try {
      data = JSON.parse(raw)
    } catch (e) {
      console.log('Unable to fetch story json')
      return
    }
    storyInfo = data.story
    storyInfo.uuid = 'urn:fimfiction:' + storyInfo.id
    storyInfo.publishDate = '1970-01-01' // TODO!

    remoteResources.set(storyInfo.full_image, {filename: 'cover'})
    let coverImage = new Image()
    coverImage.src = storyInfo.full_image

    zip.file('style.css', styleCss)
    zip.file('coverstyle.css', coverstyleCss)

    coverImage.addEventListener('load', () => {
      zip.file('toc.ncx', template.createNcx(storyInfo))
      zip.file('nav.xhtml', template.createNav(storyInfo))

      fetchChapters(() => {
        fetchRemoteFiles(zip, () => {
          let coverFilename = ''
          remoteResources.forEach((r, url) => {
            if (typeof r.chapter !== 'undefined' && r.originalUrl && r.dest) {
              chapterContent[r.chapter] = chapterContent[r.chapter].replace(
                  new RegExp(escapeStringRegexp(r.originalUrl), 'g'),
                  r.dest
                )
            }
            if (r.filename === 'cover') {
              coverFilename = r.dest
            }
          })

          for (let num = 0; num < chapterContent.length; num++) {
            let html = chapterContent[num]
            let filename = 'chapter_' + zeroFill(3, num + 1) + '.xhtml'
            zip.file(filename, html)
          }

          chapterContent.length = 0

          zip.file('cover.xhtml', template.createCoverPage(coverFilename, coverImage.width, coverImage.height))
          zip.file('content.opf', template.createOpf(storyInfo, remoteResources))

          console.log('Packaging epub...')

          zip
          .generateAsync({
            type: 'blob',
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE',
            compressionOptions: {level: 9}
          })
          .then((blob) => {
            cachedBlob = blob
            saveStory()
            isDownloading = false
          })
        })
      })
    }, false)
  })
}
