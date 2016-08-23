
import JSZip from 'jszip'
import escapeStringRegexp from 'escape-string-regexp'
import zeroFill from 'zero-fill'
import { XmlEntities } from 'html-entities'
import sanitize from 'sanitize-filename'
import URL from 'url'
import isNode from 'detect-node'
import fileType from 'file-type'

import { styleCss, coverstyleCss, titlestyleCss } from './styles'

import { cleanMarkup } from './cleanMarkup'
import fetch from './fetch'
import fetchRemote from './fetchRemote'
import * as template from './templates'

import { containerXml } from './constants'

const entities = new XmlEntities()

module.exports = class FimFic2Epub {

  static getStoryId (id) {
    if (isNaN(id)) {
      let url = URL.parse(id, false, true)
      if (url.hostname === 'www.fimfiction.net' || url.hostname === 'fimfiction.net') {
        let m = url.pathname.match(/^\/story\/(\d+)/)
        if (m) {
          id = m[1]
        }
      }
    }
    return id
  }

  static getFilename (storyInfo) {
    return sanitize(storyInfo.title + ' by ' + storyInfo.author.name + '.epub')
  }

  static fetchStoryInfo (storyId, raw = false) {
    return new Promise((resolve, reject) => {
      storyId = FimFic2Epub.getStoryId(storyId)
      let url = '/api/story.php?story=' + storyId
      fetch(url).then((content) => {
        let data
        try {
          data = JSON.parse(content)
        } catch (e) {}
        if (!data) {
          reject('Unable to fetch story info')
          return
        }
        if (data.error) {
          reject(data.error)
          return
        }
        let story = data.story
        if (raw) {
          resolve(story)
          return
        }
        // this is so the metadata can be cached.
        if (!story.chapters) story.chapters = []
        delete story.likes
        delete story.dislikes
        delete story.views
        delete story.total_views
        delete story.comments
        story.chapters.forEach((ch) => {
          delete ch.views
        })
        // Add version number
        story.FIMFIC2EPUB_VERSION = FIMFIC2EPUB_VERSION
        resolve(story)
      })
    })
  }

  static parseChapterPage (html) {
    let trimWhitespace = /^\s*(<br\s*\/?\s*>)+|(<br\s*\/?\s*>)+\s*$/ig

    let authorNotesPos = html.indexOf('<div class="authors-note"')
    let authorNotes = ''
    if (authorNotesPos !== -1) {
      authorNotesPos = authorNotesPos + html.substring(authorNotesPos).indexOf('<b>Author\'s Note:</b>')
      authorNotes = html.substring(authorNotesPos + 22)
      authorNotes = authorNotes.substring(0, authorNotes.indexOf('\t\n\t</div>'))
      authorNotes = authorNotes.trim()
      authorNotes = authorNotes.replace(trimWhitespace, '')
    }

    let chapterPos = html.indexOf('<div id="chapter_container">')
    let chapter = html.substring(chapterPos + 29)

    let pos = chapter.indexOf('\t</div>\t\t\n\t')

    chapter = chapter.substring(0, pos).trim()

    // remove leading and trailing <br /> tags and whitespace
    chapter = chapter.replace(trimWhitespace, '')
    return {content: chapter, notes: authorNotes, notesFirst: authorNotesPos < chapterPos}
  }

  constructor (storyId) {
    this.storyId = FimFic2Epub.getStoryId(storyId)

    this.hasDownloaded = false
    this.fetchPromise = null

    this.storyInfo = null
    this.chapters = []
    this.chapterContent = []
    this.remoteResources = new Map()

    this.cachedFile = null
    this.hasCoverImage = false
    this.coverImageDimensions = {width: 0, height: 0}
    // this.includeTitlePage = true
    // this.categories = []
    // this.tags = []

    this.zip = new JSZip()
  }

  fetch () {
    if (this.fetchPromise) {
      return this.fetchPromise
    }

    this.storyInfo = null
    this.chapters.length = 0
    this.remoteResources.clear()

    console.log('Fetching story metadata...')

    let p = FimFic2Epub.fetchStoryInfo(this.storyId)
      .then((storyInfo) => {
        this.storyInfo = storyInfo
        this.storyInfo.uuid = 'urn:fimfiction:' + this.storyInfo.id

        this.filename = FimFic2Epub.getFilename(this.storyInfo)
      })
      .then(this.fetchTitlePage.bind(this))
      .then(this.fetchChapters.bind(this))
      .then(() => {
        console.log('Fetch complete')
        console.log(this)
        this.fetchPromise = null
      })

    this.fetchPromise = p
    return p
  }

  build () {
    this.chapterContent.length = 0
    return this.checkCoverImage()
      .then(this.processChapters.bind(this))
      .then(this.fetchRemoteFiles.bind(this))
      .then(this.processStory.bind(this))
      .then(() => {
        console.log('Build complete')
      })
  }

  fetchTitlePage () {
    console.log('Fetching title page...')
    let url = this.storyInfo.url.replace('http://www.fimfiction.net', '')
    return fetch(url).then(this.extractTitlePageInfo.bind(this))
  }

  extractTitlePageInfo (html) {
    let descPos = html.indexOf('<div class="description" id="description')
    descPos = descPos + html.substring(descPos).indexOf('">') + 2
    html = html.substring(descPos)
    let ma = html.match(/<a href="(.*?)" class="source">Source<\/a>/)
    this.storyInfo.source_image = null
    if (ma) {
      this.storyInfo.source_image = ma[1]
    }
    let endCatsPos = html.indexOf('<hr />')
    let startCatsPos = html.substring(0, endCatsPos).lastIndexOf('</div>')
    let catsHtml = html.substring(startCatsPos, endCatsPos)
    html = html.substring(endCatsPos + 6)

    let categories = []
    let matchCategory = /<a href="(.*?)" class="(.*?)">(.*?)<\/a>/g
    for (let c; (c = matchCategory.exec(catsHtml));) {
      categories.push({
        url: 'http://www.fimfiction.net' + c[1],
        className: c[2],
        name: entities.decode(c[3])
      })
    }
    this.categories = categories

    ma = html.match(/This story is a sequel to <a href="([^"]*)">(.*?)<\/a>/)
    if (ma) {
      this.storyInfo.prequel = {
        url: 'http://www.fimfiction.net' + ma[1],
        title: entities.decode(ma[2])
      }
      html = html.substring(html.indexOf('<hr />') + 6)
    }
    let endDescPos = html.indexOf('</div>\n')
    let description = html.substring(0, endDescPos).trim()

    html = html.substring(endDescPos + 7)
    let extraPos = html.indexOf('<div class="extra_story_data">')
    html = html.substring(extraPos + 30)

    ma = html.match(/<span class="published">First Published<\/span><br \/><span>(.*?)<\/span>/)
    if (ma) {
      let date = ma[1]
      date = date.replace(/^(\d+)[a-z]+? ([a-zA-Z]+? \d+)$/, '$1 $2')
      this.storyInfo.publishDate = (new Date(date).getTime() / 1000) | 0
    }

    html = html.substring(0, html.indexOf('<div class="button-group"'))

    let tags = []
    tags.byImage = {}
    let matchTag = /<a href="\/tag\/(.*?)" class="character_icon" title="(.*?)" style=".*?"><img src="(.*?)" class="character_icon" \/><\/a>/g
    for (let tag; (tag = matchTag.exec(html));) {
      let t = {
        url: 'http://www.fimfiction.net/tag/' + tag[1],
        name: entities.decode(tag[2]),
        image: entities.decode(tag[3])
      }
      tags.push(t)
      tags.byImage[t.image] = t
      if (this.includeTitlePage) {
        this.remoteResources.set(t.image, {filename: 'tag-' + tag[1], originalUrl: t.image, where: ['tags']})
      }
    }
    this.tags = tags

    return cleanMarkup(description).then((html) => {
      this.storyInfo.description = html
      this.findRemoteResources('description', 'description', html)
    })
  }

  fetchChapters () {
    console.log('Fetching chapters...')
    return new Promise((resolve, reject) => {
      let chapters = this.storyInfo.chapters
      let chapterCount = this.storyInfo.chapters.length
      let currentChapter = 0
      let completeCount = 0

      if (chapterCount === 0) {
        resolve()
        return
      }

      let recursive = () => {
        let index = currentChapter++
        let ch = chapters[index]
        if (!ch) {
          return
        }
        console.log('Fetching chapter ' + (index + 1) + ' of ' + chapters.length + ': ' + ch.title)
        let url = ch.link.replace('http://www.fimfiction.net', '')
        fetch(url).then((html) => {
          this.chapters[index] = FimFic2Epub.parseChapterPage(html)
          completeCount++
          if (completeCount < chapterCount) {
            recursive()
          } else {
            resolve()
          }
        })
      }

      // concurrent downloads!
      recursive()
      recursive()
      recursive()
      recursive()
    })
  }

  checkCoverImage () {
    return new Promise((resolve, reject) => {
      this.hasCoverImage = !!this.storyInfo.full_image

      if (this.hasCoverImage) {
        this.remoteResources.set(this.storyInfo.full_image, {filename: 'cover', where: ['cover']})

        if (!isNode) {
          let coverImage = new Image()
          coverImage.src = this.storyInfo.full_image

          coverImage.addEventListener('load', () => {
            this.coverImageDimensions.width = coverImage.width
            this.coverImageDimensions.height = coverImage.height
            resolve()
          }, false)
          coverImage.addEventListener('error', () => {
            console.warn('Unable to fetch cover image, skipping...')
            this.hasCoverImage = false
            resolve()
          })
        } else {
          resolve()
        }
      } else {
        resolve()
      }
    })
  }

  processChapters () {
    let p = []
    for (let i = 0; i < this.storyInfo.chapters.length; i++) {
      let ch = this.storyInfo.chapters[i]
      p.push(template.createChapter(ch, this.chapters[i]).then((html) => {
        this.findRemoteResources('ch_' + zeroFill(3, i + 1), i, html)
        this.chapterContent[i] = html
      }))
    }
    return Promise.all(p)
  }

  processStory () {
    console.log('Finishing build...')

    this.zip.file('mimetype', 'application/epub+zip')
    this.zip.file('META-INF/container.xml', containerXml)

    let coverFilename = ''
    this.remoteResources.forEach((r, url) => {
      let dest = '../' + r.dest
      if (r.dest && r.originalUrl && r.where) {
        let ourl = new RegExp(escapeStringRegexp(r.originalUrl), 'g')
        for (var i = 0; i < r.where.length; i++) {
          let w = r.where[i]
          if (typeof w === 'number') {
            this.chapterContent[w] = this.chapterContent[w].replace(ourl, dest)
          } else if (w === 'description') {
            this.storyInfo.description = this.storyInfo.description.replace(ourl, dest)
          } else if (w === 'tags') {
            this.tags.byImage[r.originalUrl].image = dest
          }
        }
      }
      if (r.filename === 'cover' && r.dest) {
        coverFilename = dest
      }
    })

    for (let num = 0; num < this.chapterContent.length; num++) {
      let html = this.chapterContent[num]
      let filename = 'OEBPS/Text/chapter_' + zeroFill(3, num + 1) + '.xhtml'
      this.zip.file(filename, html)
    }

    this.chapterContent.length = 0

    this.zip.file('OEBPS/content.opf', template.createOpf(this))

    if (this.hasCoverImage) {
      this.zip.file('OEBPS/Text/cover.xhtml', template.createCoverPage(coverFilename, this.coverImageDimensions.width, this.coverImageDimensions.height))
    } else {
      this.zip.file('OEBPS/Text/cover.xhtml', template.createCoverPage(this))
    }

    if (this.includeTitlePage) {
      this.zip.file('OEBPS/Text/title.xhtml', template.createTitlePage(this))
    }

    this.zip.file('OEBPS/Text/nav.xhtml', template.createNav(this))
    this.zip.file('OEBPS/toc.ncx', template.createNcx(this))

    this.zip.file('OEBPS/Styles/style.css', styleCss)
    this.zip.file('OEBPS/Styles/coverstyle.css', coverstyleCss)
    if (this.includeTitlePage) {
      this.zip.file('OEBPS/Styles/titlestyle.css', titlestyleCss)
    }

    this.hasDownloaded = true
  }

  fetchRemoteFiles () {
    return new Promise((resolve, reject) => {
      console.log('Fetching remote files...')
      let iter = this.remoteResources.entries()
      let count = 0
      let completeCount = 0

      let recursive = () => {
        let r = iter.next().value
        if (!r) {
          if (completeCount === this.remoteResources.size) {
            resolve()
          }
          return
        }
        let url = r[0]
        r = r[1]

        console.log('Fetching remote file ' + (count + 1) + ' of ' + this.remoteResources.size + ': ' + r.filename, url)
        count++

        fetchRemote(url).then((data) => {
          r.dest = null
          let info = fileType(isNode ? data : new Uint8Array(data))
          if (info) {
            let type = info.mime
            r.type = type
            let isImage = type.indexOf('image/') === 0
            let folder = isImage ? 'Images' : 'Misc'
            let dest = folder + '/*.' + info.ext
            r.dest = dest.replace('*', r.filename)
            this.zip.file('OEBPS/' + r.dest, data)
            if (isNode && r.filename === 'cover') {
              const sizeOf = require('image-size')
              this.coverImageDimensions = sizeOf(data)
            }
          }
          completeCount++
          recursive()
        }, 'arraybuffer')
      }

      // concurrent downloads!
      recursive()
      recursive()
      recursive()
      recursive()
    })
  }

  findRemoteResources (prefix, where, html) {
    let remoteCounter = 1
    let matchUrl = /<img.*?src="([^">]*\/([^">]*?))".*?>/g
    let emoticonUrl = /static\.fimfiction\.net\/images\/emoticons\/([a-z_]*)\.[a-z]*$/

    for (let ma; (ma = matchUrl.exec(html));) {
      let url = ma[1]
      let cleanurl = decodeURI(entities.decode(url))
      if (this.remoteResources.has(cleanurl)) {
        let r = this.remoteResources.get(cleanurl)
        if (r.where.indexOf(where) === -1) {
          r.where.push(where)
        }
        continue
      }
      let filename = prefix + '_' + remoteCounter
      let emoticon = url.match(emoticonUrl)
      if (emoticon) {
        filename = 'emoticon_' + emoticon[1]
      }
      remoteCounter++
      this.remoteResources.set(cleanurl, {filename: filename, where: [where], originalUrl: url})
    }
  }

  // for node, resolve a Buffer, in browser resolve a Blob
  getFile () {
    return new Promise((resolve, reject) => {
      if (this.cachedFile) {
        resolve(this.cachedFile)
        return
      }
      if (!this.hasDownloaded) {
        reject('Not downloaded.')
        return
      }
      this.zip
      .generateAsync({
        type: isNode ? 'nodebuffer' : 'blob',
        mimeType: 'application/epub+zip',
        compression: 'DEFLATE',
        compressionOptions: {level: 9}
      }).then((file) => {
        this.cachedFile = file
        resolve(file)
      })
    })
  }

  // example usage: .pipe(fs.createWriteStream(filename))
  streamFile () {
    if (!this.hasDownloaded) {
      return null
    }
    return this.zip
    .generateNodeStream({
      type: 'nodebuffer',
      streamFiles: false,
      mimeType: 'application/epub+zip',
      compression: 'DEFLATE',
      compressionOptions: {level: 9}
    })
  }
}
