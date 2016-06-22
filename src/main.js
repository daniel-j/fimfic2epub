/* global chrome, safari */

import JSZip from 'jszip'
import m from 'mithril'
import render from './lib/mithril-node-render'
import { pd as pretty } from 'pretty-data'
import escapeStringRegexp from 'escape-string-regexp'
import { XmlEntities } from 'html-entities'
import { saveAs } from 'file-saver'
import tidy from 'exports?tidy_html5!tidy-html5'
import zeroFill from 'zero-fill'

import styleCss from './style'
import coverstyleCss from './coverstyle'

const entities = new XmlEntities()

const NS = {
  OPF: 'http://www.idpf.org/2007/opf',
  OPS: 'http://www.idpf.org/2007/ops',
  DC: 'http://purl.org/dc/elements/1.1/',
  DAISY: 'http://www.daisy.org/z3986/2005/ncx/',
  XHTML: 'http://www.w3.org/1999/xhtml',
  SVG: 'http://www.w3.org/2000/svg',
  XLINK: 'http://www.w3.org/1999/xlink'
}

let tidyOptions = {
  'indent': 'auto',
  'numeric-entities': 'yes',
  'output-xhtml': 'yes',
  'alt-text': 'Image',
  'wrap': '0',
  'quiet': 'yes',
  'show-warnings': 0,
  'newline': 'LF',
  'tidy-mark': 'no'
}

let mimeMap = {
  'image/jpeg': 'Images/*.jpg',
  'image/png': 'Images/*.png',
  'image/gif': 'Images/*.gif'
}

const STORY_ID = document.location.pathname.match(/^\/story\/(\d*)/)[1]

let storyInfo
let remoteResources = new Map()
let chapterContent = []

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
    cb(null)
  }
  x.send()
}

function fetchChapters (cb) {
  let chapters = storyInfo.chapters
  let chapterCount = storyInfo.chapters.length
  let currentChapter = 0
  function recursive () {
    let ch = chapters[currentChapter]
    console.log('Fetching chapter ' + (currentChapter + 1) + ' of ' + chapters.length + ': ' + ch.title)
    fetchRemote(ch.link.replace('http', 'https'), function (html) {
      html = parseChapter(currentChapter, ch, html)
      chapterContent[currentChapter] = html
      currentChapter++
      if (currentChapter < chapterCount) {
        recursive()
      } else {
        cb()
      }
    })
  }
  recursive()
}

let safariQueue = {}

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
      /*
      let str = ''
      let arr = new Uint8Array(data)
      for (let i = 0; i < arr.length; i++) {
        str += String.fromCharCode(arr[i])
      }
      cb(str, type)
      */
    } else {
      cb(data, type)
    }
  }
}
if (typeof safari !== 'undefined') {
  safari.self.addEventListener('message', safariHandler, false)
}

function fetchRemote (url, cb, responseType) {
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
    fetchRemote(url, function (data, type) {
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

function downloadStory () {
  isDownloading = true

  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip')
  zip.folder('META-INF').file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`)

  console.log('Fetching story metadata...')

  fetchRemote('https://www.fimfiction.net/api/story.php?story=' + STORY_ID, function (raw, type) {
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

    coverImage.addEventListener('load', function () {
      zip.file('toc.ncx', createNcx())
      zip.file('nav.xhtml', createNav())

      fetchChapters(function () {
        fetchRemoteFiles(zip, function () {
          remoteResources.forEach((r, url) => {
            if (typeof r.chapter !== 'undefined' && r.originalUrl && r.dest) {
              chapterContent[r.chapter] = chapterContent[r.chapter].replace(
                  new RegExp(escapeStringRegexp(r.originalUrl), 'g'),
                  r.dest
                )
            } else {
              r.remote = true
            }
          })

          for (let num = 0; num < chapterContent.length; num++) {
            let html = chapterContent[num]
            let filename = 'chapter_' + zeroFill(3, num + 1) + '.xhtml'
            zip.file(filename, html)
          }

          zip.file('cover.xhtml', createCoverPage(coverImage.width, coverImage.height))
          zip.file('content.opf', createOpf())

          /*
          zip
          .generateNodeStream({
            type: 'nodebuffer',
            streamFiles: true,
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE',
            compressionOptions: {level: 9}
          })
          .pipe(fs.createWriteStream('out.epub'))
          .on('finish', function () {
            // JSZip generates a readable stream with a "end" event,
            // but is piped here in a writable stream which emits a "finish" event.
            console.log("out.epub written.");
          })
          */

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

function blobToDataURL (blob, callback) {
  let a = new FileReader()
  a.onloadend = function (e) { callback(a.result) }
  a.readAsDataURL(blob)
}

function saveStory () {
  console.log('Saving epub...')
  if (typeof safari !== 'undefined') {
    blobToDataURL(cachedBlob, function (dataurl) {
      document.location.href = dataurl
      alert('Rename downloaded file to .epub')
    })
  } else {
    saveAs(cachedBlob, storyInfo.title + ' by ' + storyInfo.author.name + '.epub')
  }
}

function parseChapter (num, ch, html) {
  let chapterTitle = html.match(/<a\s+[^>]*id="chapter_title"[^>]*>(.*?)<\/a>/)

  if (!chapterTitle) {
    return tidy('<?xml version="1.0" encoding="utf-8"?>\n' + chapterPage, tidyOptions)
  }
  chapterTitle = chapterTitle[1]

  let chapterPos = html.indexOf('<div id="chapter_container">')
  let chapter = html.substring(chapterPos + 29)

  let pos = chapter.indexOf('\t</div>\t\t\n\t')

  let authorNotesPos = chapter.substring(pos).indexOf('<b>Author\'s Note:</b>')
  let authorNotes = ''
  if (authorNotesPos !== -1) {
    authorNotes = chapter.substring(pos + authorNotesPos + 22)
    authorNotes = authorNotes.substring(0, authorNotes.indexOf('\t\t\n\t</div>'))
  }

  chapter = chapter.substring(0, pos)

  let chapterPage = '<!doctype html>' + render(
    m('html', {xmlns: NS.XHTML}, [
      m('head', [
        m('meta', {charset: 'utf-8'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: 'style.css'}),
        m('title', ch.title)
      ]),
      m('body', [
        m('div#chapter_container', m.trust(chapter)),
        authorNotes ? m('div#author_notes', m.trust(authorNotes)) : null
      ])
    ])
  )

  chapterPage = chapterPage.replace(/<center>/g, '<div style="text-align: center;">')
  chapterPage = chapterPage.replace(/<\/center>/g, '</div>')

  chapterPage = chapterPage.replace(/<div class="youtube_container">(.+?)<\/div>/g, function (match, contents, offset) {
    // console.log(match, contents, offset)
    let youtubeId = contents.match(/src="https:\/\/www.youtube.com\/embed\/(.+?)"/)[1]
    let thumbnail = 'http://img.youtube.com/vi/' + youtubeId + '/hqdefault.jpg'
    let youtubeUrl = 'https://youtube.com/watch?v=' + youtubeId
    return render(m('a', {href: youtubeUrl, target: '_blank'},
      m('img', {src: thumbnail, alt: 'Youtube Video'})
    ))
  })

  chapterPage = chapterPage.replace('<blockquote style="margin: 10px 0px; box-sizing:border-box; -moz-box-sizing:border-box;margin-right:25px; padding: 15px;background-color: #F7F7F7;border: 1px solid #AAA;width: 50%;float:left;box-shadow: 5px 5px 0px #EEE;">', '<blockquote class="left_insert">')
  chapterPage = chapterPage.replace('<blockquote style="margin: 10px 0px; box-sizing:border-box; -moz-box-sizing:border-box;margin-left:25px; padding: 15px;background-color: #F7F7F7;border: 1px solid #AAA;width: 50%;float:right;box-shadow: 5px 5px 0px #EEE;">', '<blockquote class="right_insert">')

  chapterPage = tidy(`<?xml version="1.0" encoding="utf-8"?>\n` + chapterPage, tidyOptions)

  let remoteCounter = 1
  chapterPage = chapterPage.replace(/(<img src=")(.+?)("[^>]*>)/g, function (match, first, url, last) {
    let cleanurl = decodeURI(entities.decode(url))
    if (remoteResources.has(cleanurl)) {
      return match
    }
    let filename = 'ch_' + zeroFill(3, num + 1) + '_' + remoteCounter
    remoteCounter++
    remoteResources.set(cleanurl, {filename: filename, chapter: num, originalUrl: url})
    return match
  })

  return chapterPage
}

function subjects (s) {
  let list = []
  for (let i = 0; i < s.length; i++) {
    list.push(m('dc:subject', s[i]))
  }
  return list
}

function createOpf () {
  let remotes = []
  remoteResources.forEach((r, url) => {
    if (!r.dest) {
      return
    }
    let attrs = {id: r.filename, href: r.dest, 'media-type': r.type}
    if (r.filename === 'cover') {
      attrs.properties = 'cover-image'
    }
    remotes.push(m('item', attrs))
  })

  let contentOpf = '<?xml version="1.0" encoding="utf-8"?>\n' + pretty.xml(render(
    m('package', {xmlns: NS.OPF, version: '3.0', 'unique-identifier': 'BookId'}, [
      m('metadata', {'xmlns:dc': NS.DC, 'xmlns:opf': NS.OPF}, [
        m('dc:identifier#BookId', storyInfo.uuid),
        m('dc:title', storyInfo.title),
        m('dc:creator#cre', storyInfo.author.name),
        m('meta', {refines: '#cre', property: 'role', scheme: 'marc:relators'}, 'aut'),
        m('dc:date', storyInfo.publishDate),
        m('dc:publisher', 'Fimfiction'),
        m('dc:description', storyInfo.description),
        m('dc:source', storyInfo.url),
        m('dc:language', 'en'),
        m('meta', {name: 'cover', content: 'cover'}),
        m('meta', {property: 'dcterms:modified'}, new Date(storyInfo.date_modified * 1000).toISOString().replace('.000', ''))
      ].concat(subjects(['Fiction', 'Pony']))),

      m('manifest', [
        m('item', {id: 'ncx', href: 'toc.ncx', 'media-type': 'application/x-dtbncx+xml'}),
        m('item', {id: 'nav', 'href': 'nav.xhtml', 'media-type': 'application/xhtml+xml', properties: 'nav'}),
        m('item', {id: 'style', href: 'style.css', 'media-type': 'text/css'}),
        m('item', {id: 'coverstyle', href: 'coverstyle.css', 'media-type': 'text/css'}),
        m('item', {id: 'coverpage', href: 'cover.xhtml', 'media-type': 'application/xhtml+xml', properties: 'svg'})
      ].concat(storyInfo.chapters.map((ch, num) =>
        m('item', {id: 'chapter_' + zeroFill(3, num + 1), href: 'chapter_' + zeroFill(3, num + 1) + '.xhtml', 'media-type': 'application/xhtml+xml'})
      ), remotes)),

      m('spine', {toc: 'ncx'}, [
        m('itemref', {idref: 'coverpage'}),
        m('itemref', {idref: 'nav'})
      ].concat(storyInfo.chapters.map((ch, num) =>
        m('itemref', {idref: 'chapter_' + zeroFill(3, num + 1)})
      ))),

      false ? m('guide', [

      ]) : null
    ])
  ))
  // console.log(contentOpf)
  return contentOpf
}

function navPoints (list) {
  let arr = []
  for (let i = 0; i < list.length; i++) {
    list[i]
    arr.push(m('navPoint', {id: 'navPoint-' + (i + 1), playOrder: i + 1}, [
      m('navLabel', m('text', list[i][0])),
      m('content', {src: list[i][1]})
    ]))
  }
  return arr
}

function createNcx () {
  let tocNcx = '<?xml version="1.0" encoding="utf-8" ?>\n' + pretty.xml(render(
    m('ncx', {version: '2005-1', xmlns: NS.DAISY}, [
      m('head', [
        m('meta', {content: storyInfo.uuid, name: 'dtb:uid'}),
        m('meta', {content: 0, name: 'dtb:depth'}),
        m('meta', {content: 0, name: 'dtb:totalPageCount'}),
        m('meta', {content: 0, name: 'dtb:maxPageNumber'})
      ]),
      m('docTitle', m('text', storyInfo.title)),
      m('navMap', navPoints([
        ['Cover', 'cover.xhtml'],
        ['Contents', 'nav.xhtml']
      ].concat(storyInfo.chapters.map((ch, num) =>
        [ch.title, 'chapter_' + zeroFill(3, num + 1) + '.xhtml']
      ))))
    ])
  ))
  // console.log(tocNcx)
  return tocNcx
}

function createNav () {
  let navDocument = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + pretty.xml(render(
    m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS, lang: 'en', 'xml:lang': 'en'}, [
      m('head', [
        m('meta', {charset: 'utf-8'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: 'style.css'}),
        m('title', 'Contents')
      ]),
      m('body', [
        m('nav#toc', {'epub:type': 'toc'}, [
          m('h1', 'Contents'),
          m('ol', [
            m('li', {hidden: ''}, m('a', {href: 'cover.xhtml'}, 'Cover')),
            m('li', {hidden: ''}, m('a', {href: 'nav.xhtml'}, 'Contents'))
          ].concat(storyInfo.chapters.map((ch, num) =>
            m('li', m('a', {href: 'chapter_' + zeroFill(3, num + 1) + '.xhtml'}, ch.title))
          )))
        ])
      ])
    ])
  ))
  // console.log(navDocument)
  return navDocument
}

function createCoverPage (w, h) {
  let coverPage = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + pretty.xml(render(
    m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
      m('head', [
        m('meta', {name: 'viewport', content: 'width=' + w + ', height=' + h}),
        m('title', 'Cover'),
        m('link', {rel: 'stylesheet', type: 'text/css', href: 'coverstyle.css'})
      ]),
      m('body', {'epub:type': 'cover'}, [
        m('svg#cover', {xmlns: NS.SVG, 'xmlns:xlink': NS.XLINK, version: '1.1', viewBox: '0 0 ' + w + ' ' + h},
          m('image', {width: w, height: h, 'xlink:href': 'Images/cover.jpg'})
        )
      ])
    ])
  ))
  // console.log(coverPage)
  return coverPage
}
