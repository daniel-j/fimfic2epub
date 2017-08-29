
import JSZip from 'jszip'
import escapeStringRegexp from 'escape-string-regexp'
import zeroFill from 'zero-fill'
import { XmlEntities } from 'html-entities'
import sanitize from 'sanitize-filename'
import URL from 'url'
import isNode from 'detect-node'
import fileType from 'file-type'
import isSvg from 'is-svg'
import sizeOf from 'image-size'
import Emitter from 'es6-event-emitter'

import { styleCss, coverstyleCss, titlestyleCss, paragraphsCss } from './styles'

import { cleanMarkup } from './cleanMarkup'
import htmlWordCount from './html-wordcount'
import fetch from './fetch'
import fetchRemote from './fetchRemote'
import * as template from './templates'

import { containerXml } from './constants'

const entities = new XmlEntities()

const trimWhitespace = /^\s*(<br\s*\/?\s*>)+|(<br\s*\/?\s*>)+\s*$/ig

class FimFic2Epub extends Emitter {

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

  constructor (storyId) {
    super()

    this.storyId = FimFic2Epub.getStoryId(storyId)

    this.options = {
      addCommentsLink: true,
      includeAuthorNotes: true,
      useAuthorNotesIndex: false,
      addChapterHeadings: true,
      includeExternal: true,
      paragraphStyle: 'spaced',
      joinSubjects: false
    }

    // promise cache
    this.pcache = {
      metadata: null,
      chapters: null,
      remoteResources: null,
      coverImage: null,
      fetchAll: null
    }

    this.storyInfo = null
    this.description = ''
    this.subjects = []
    this.chapters = []
    this.chaptersHtml = []
    this.notesHtml = []
    this.hasAuthorNotes = false
    this.chaptersWithNotes = []
    this.remoteResourcesCached = false
    this.remoteResources = new Map()
    this.coverUrl = ''
    this.coverImage = null
    this.coverFilename = ''
    this.coverType = ''
    this.coverImageDimensions = {width: 0, height: 0}

    this.hasRemoteResources = {
      titlePage: false
    }

    this.cachedFile = null
    this.categories = []
    this.tags = []

    this.zip = null
  }

  fetchAll () {
    if (this.pcache.fetchAll) {
      return this.pcache.fetchAll
    }

    this.progress(0, 0, 'Fetching...')

    this.pcache.fetchAll = this.fetchMetadata()
      .then(this.fetchChapters.bind(this))
      .then(this.fetchCoverImage.bind(this))
      .then(this.buildChapters.bind(this))
      .then(this.fetchRemoteFiles.bind(this))
      .then(() => {
        this.progress(0, 0.95)
        this.pcache.fetchAll = null
      })

    return this.pcache.fetchAll
  }

  fetchMetadata () {
    if (this.pcache.metadata) {
      return this.pcache.metadata
    }
    if (this.storyInfo) {
      return Promise.resolve()
    }
    this.storyInfo = null
    this.description = ''
    this.subjects = []

    this.progress(0, 0, 'Fetching metadata...')

    this.pcache.metadata = FimFic2Epub.fetchStoryInfo(this.storyId).then((storyInfo) => {
      this.storyInfo = storyInfo
      this.storyInfo.uuid = 'urn:fimfiction:' + this.storyInfo.id
      this.filename = FimFic2Epub.getFilename(this.storyInfo)
      this.progress(0, 0.5)
    })
    .then(this.fetchTitlePage.bind(this))
    .then(() => {
      this.progress(0, 1)
    })
    .then(() => cleanMarkup(this.description)).then((html) => {
      this.storyInfo.description = html
      this.findRemoteResources('description', 'description', html)
    }).then(() => {
      this.pcache.metadata = null
    })
    return this.pcache.metadata
  }

  fetchChapters () {
    if (this.pcache.chapters) {
      return this.pcache.chapters
    }
    // chapters have already been fetched
    if (this.chapters.length !== 0) {
      return Promise.resolve()
    }
    this.chapters.length = 0
    this.chaptersHtml.length = 0
    this.hasAuthorNotes = false
    this.chaptersWithNotes.length = 0

    this.progress(0, 0, 'Fetching chapters...')

    let chapterCount = this.storyInfo.chapters.length
    let url = 'https://www.fimfiction.net/story/download/' + this.storyInfo.id + '/html'

    this.pcache.chapters = fetch(url).then((html) => {
      // console.log(html)
      let p = Promise.resolve()
      let matchChapter = /<article class="chapter">[\s\S]*?<\/header>([\s\S]*?)<\/article>/g
      for (let ma, i = 0; (ma = matchChapter.exec(html)); i++) {
        let chapterContent = ma[1]
        chapterContent = chapterContent.replace(/<footer>[\s\S]*?<\/footer>/g, '').trim()

        let authorNotesPos = chapterContent.indexOf('<aside ')
        let notesContent = ''
        let notesFirst = authorNotesPos === 0
        if (authorNotesPos !== -1) {
          // console.log(chapterContent.length)
          chapterContent = chapterContent.replace(/<aside class="authors-note">([\s\S]*?)<\/aside>/, (match, content, pos) => {
            // console.log(pos + match.length)
            content = content.replace(/<header><h1>.*?<\/h1><\/header>/, '')
            notesContent = content.trim().replace(trimWhitespace, '')
            return ''
          })
        }

        chapterContent = chapterContent.trim().replace(trimWhitespace, '')
        let chapter = {content: chapterContent, notes: notesContent, notesFirst}
        p = p.then(cleanMarkup(chapter.content).then((content) => {
          chapter.content = content
        }))
        if (notesContent) {
          p = p.then(cleanMarkup(chapter.notes).then((notes) => {
            chapter.notes = notes
          }))
        }
        p = p.then(() => {
          this.progress(0, (i + 1) / chapterCount, 'Processed chapter ' + (i + 1) + ' / ' + chapterCount)
          if (chapter.notes) {
            this.hasAuthorNotes = true
            this.chaptersWithNotes.push(i)
          }
          this.chapters[i] = chapter
          let ch = this.storyInfo.chapters[i]
          ch.realWordCount = htmlWordCount(chapter.content)
        })
      }
      return p
    }).then(() => {
      this.pcache.chapters = null
    })

    return this.pcache.chapters
  }

  fetchRemoteFiles () {
    if (!this.options.includeExternal) {
      return Promise.resolve()
    }
    if (this.pcache.remoteResources) {
      return this.pcache.remoteResources
    }
    if (this.remoteResourcesCached) {
      return Promise.resolve()
    }

    this.progress(0, 0, 'Fetching remote files...')
    this.pcache.remoteResources = new Promise((resolve, reject) => {
      let iter = this.remoteResources.entries()
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

        fetchRemote(url, 'arraybuffer').then((data) => {
          r.dest = null
          let info = fileType(isNode ? data : new Uint8Array(data))
          if (!info) {
            // file-type doesn't support SVG, extra check:
            if (isSvg(Buffer.from(data).toString('utf8'))) {
              info = {
                mime: 'image/svg+xml',
                ext: 'svg'
              }
            }
          }
          if (info) {
            let type = info.mime
            r.type = type
            let isImage = type.indexOf('image/') === 0
            let folder = isImage ? 'Images' : 'Misc'
            let dest = folder + '/*.' + info.ext
            r.dest = dest.replace('*', r.filename)
            r.data = data
          }
          completeCount++
          this.progress(0, completeCount / this.remoteResources.size, 'Fetched remote file ' + completeCount + ' / ' + this.remoteResources.size)
          recursive()
        })
      }

      // concurrent downloads!
      recursive()
      recursive()
      recursive()
      recursive()
    }).then(() => {
      this.remoteResourcesCached = true
      this.pcache.remoteResources = null
    })
    return this.pcache.remoteResources
  }

  buildChapters () {
    let chain = Promise.resolve()
    this.chaptersHtml.length = 0
    this.notesHtml.length = 0

    for (let i = 0; i < this.chapters.length; i++) {
      let ch = this.storyInfo.chapters[i]
      let chapter = this.chapters[i]
      chain = chain.then(template.createChapter.bind(null, {
        title: this.options.addChapterHeadings ? ch.title : null,
        link: this.options.addCommentsLink ? ch.link : null,
        linkNotes: this.options.includeAuthorNotes && this.options.useAuthorNotesIndex && chapter.notes ? 'note_' + zeroFill(3, i + 1) + '.xhtml' : null,
        content: chapter.content,
        notes: !this.options.useAuthorNotesIndex ? chapter.notes : '',
        notesFirst: chapter.notesFirst
      })).then((html) => {
        this.findRemoteResources('ch_' + zeroFill(3, i + 1), {chapter: i}, html)
        this.chaptersHtml[i] = html
      })
      if (this.options.includeAuthorNotes && this.options.useAuthorNotesIndex && chapter.notes) {
        chain = chain.then(template.createChapter.bind(null, {
          title: 'Author\'s Note: ' + ch.title,
          content: chapter.notes
        })).then((html) => {
          this.findRemoteResources('note_' + zeroFill(3, i + 1), {note: i}, html)
          this.notesHtml[i] = html
        })
      }
    }

    return chain
  }

  build () {
    this.cachedFile = null
    this.zip = null

    this.replaceRemoteResources()

    this.zip = new JSZip()

    this.zip.file('mimetype', 'application/epub+zip')
    this.zip.file('META-INF/container.xml', containerXml)

    this.zip.file('OEBPS/content.opf', template.createOpf(this))

    if (this.coverImage) {
      this.zip.file('OEBPS/' + this.coverFilename, this.coverImage)
    }
    this.zip.file('OEBPS/Text/cover.xhtml', template.createCoverPage(this))
    this.zip.file('OEBPS/Styles/coverstyle.css', coverstyleCss)

    this.zip.file('OEBPS/Text/title.xhtml', template.createTitlePage(this))
    this.zip.file('OEBPS/Styles/titlestyle.css', titlestyleCss)

    this.zip.file('OEBPS/Text/nav.xhtml', template.createNav(this, 0))
    this.zip.file('OEBPS/toc.ncx', template.createNcx(this))

    for (let i = 0; i < this.chapters.length; i++) {
      let filename = 'OEBPS/Text/chapter_' + zeroFill(3, i + 1) + '.xhtml'
      let html = this.chaptersHtml[i]
      this.zip.file(filename, html)
    }

    if (this.options.includeAuthorNotes && this.options.useAuthorNotesIndex && this.hasAuthorNotes) {
      this.zip.file('OEBPS/Text/notesnav.xhtml', template.createNav(this, 1))

      for (let i = 0; i < this.chapters.length; i++) {
        if (!this.chapters[i].notes) continue
        let filename = 'OEBPS/Text/note_' + zeroFill(3, i + 1) + '.xhtml'
        let html = this.notesHtml[i]
        this.zip.file(filename, html)
      }
    }

    this.zip.file('OEBPS/Styles/style.css', styleCss + '\n\n' + (paragraphsCss[this.options.paragraphStyle] || ''))

    this.remoteResources.forEach((r) => {
      if (r.dest) {
        this.zip.file('OEBPS/' + r.dest, r.data)
      }
    })
  }

  // for node, resolve a Buffer, in browser resolve a Blob
  getFile () {
    if (!this.zip) {
      return Promise.reject('Not downloaded.')
    }
    if (this.cachedFile) {
      return Promise.resolve(this.cachedFile)
    }
    this.progress(0, 0.95, 'Compressing...')

    return this.zip
      .generateAsync({
        type: isNode ? 'nodebuffer' : 'blob',
        mimeType: 'application/epub+zip',
        compression: 'DEFLATE',
        compressionOptions: {level: 9}
      })
      .then((file) => {
        this.progress(0, 1, 'Complete!')
        this.cachedFile = file
        return file
      })
  }

  // example usage: .pipe(fs.createWriteStream(filename))
  streamFile () {
    if (!this.zip) {
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

  setTitle (title) {
    this.storyInfo.title = title.trim()
    this.filename = FimFic2Epub.getFilename(this.storyInfo)
  }
  setAuthorName (name) {
    this.storyInfo.author.name = name.trim()
    this.filename = FimFic2Epub.getFilename(this.storyInfo)
  }
  setCoverImage (buffer) {
    let info = fileType(isNode ? buffer : new Uint8Array(buffer))
    if (!info || info.mime.indexOf('image/') !== 0) {
      throw new Error('Invalid image')
    }
    this.coverImage = buffer
    this.coverFilename = 'Images/cover.' + info.ext
    this.coverType = info.mime
    this.coverImageDimensions = sizeOf(new Buffer(buffer))
  }

  // Internal/private methods
  progress (part, percent, status = '') {
    // let parts = 6.3
    // let partsize = 1 / parts
    // percent = (part / parts) + percent * partsize
    try {
      this.trigger('progress', percent, status)
    } catch (err) {
      console.error(err)
    }
    if (status) {
      console.log(status)
    }
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

  fetchCoverImage () {
    if (this.pcache.coverImage) {
      return this.pcache.coverImage
    }
    if (this.coverImage) {
      return Promise.resolve(this.coverImage)
    }
    this.coverImage = null
    let url = this.coverUrl || this.storyInfo.full_image
    if (!url) {
      return Promise.resolve(null)
    }

    this.progress(0, 0, 'Fetching cover image...')

    this.pcache.coverImage = fetchRemote(url, 'arraybuffer').then((data) => {
      let info = fileType(isNode ? data : new Uint8Array(data))
      if (info) {
        let type = info.mime
        let isImage = type.indexOf('image/') === 0
        if (!isImage) {
          return null
        }
        let filename = 'Images/cover.' + info.ext
        this.coverFilename = filename
        this.coverType = type

        this.coverImageDimensions = sizeOf(new Buffer(data))
        this.coverImage = data
        this.coverFilename = filename
        return this.coverImage
      } else {
        return null
      }
    }).then(() => {
      this.pcache.coverImage = null
    })
    return this.pcache.coverImage
  }

  fetchTitlePage () {
    let url = this.storyInfo.url.replace('http://www.fimfiction.net', '')
    return fetch(url).then(this.extractTitlePageInfo.bind(this))
  }

  extractTitlePageInfo (html) {
    let startTagsPos = html.indexOf('<div class="story_content_box"')
    startTagsPos += html.substring(startTagsPos).indexOf('<ul class="story-tags">') + 23
    let tagsHtml = html.substring(startTagsPos)

    let endTagsPos = tagsHtml.indexOf('</ul>')
    tagsHtml = tagsHtml.substring(0, endTagsPos)

    let categories = []
    let tags = []
    tags.byImage = {}
    this.subjects.length = 0
    this.subjects.push('Fimfiction')
    this.subjects.push(this.storyInfo.content_rating_text)
    // sex, gore tags
    let matchTag = /<a href="(.*?)" class="([^"]*?)">(.*?)<\/a>/g
    for (let c; (c = matchTag.exec(tagsHtml));) {
      let cat = {
        url: 'http://www.fimfiction.net' + c[1],
        className: 'story_category story_category_' + c[2].replace('tag-', ''),
        name: entities.decode(c[3])
      }
      categories.push(cat)
      this.subjects.push(cat.name)
    }
    // genre tags
    matchTag = /<a href="(.*?)" class="tag-genre" data-tag="(.*?)">(.*?)<\/a>/g
    for (let c; (c = matchTag.exec(tagsHtml));) {
      let cat = {
        url: 'http://www.fimfiction.net' + c[1],
        className: 'story_category story_category_' + c[2],
        name: entities.decode(c[3])
      }
      categories.push(cat)
      this.subjects.push(cat.name)
    }
    // character tags
    matchTag = /<a href="(.*?)" class="tag-character" title=".*?" data-tag="(.*?)">(.*?)<\/a>/g
    for (let c; (c = matchTag.exec(tagsHtml));) {
      let t = {
        url: 'http://www.fimfiction.net' + c[1],
        // filename: 'tag-' + c[2],
        name: entities.decode(c[3])
        // image: 'https://static.fimfiction.net/images/characters/' + entities.decode(c[2]).replace(/-/g, '_') + '.png'
      }
      tags.push(t)
      // tags.byImage[t.image] = t
      // this.remoteResources.set(t.image, {filename: t.filename, originalUrl: t.image, where: ['tags']})
    }
    this.categories = categories

    html = html.substring(endTagsPos + 5)
    html = html.substring(html.indexOf('<span class="description-text bbcode">') + 38)

    let ma = html.match(/This story is a sequel to <a href="([^"]*)">(.*?)<\/a>/)
    if (ma) {
      this.storyInfo.prequel = {
        url: 'http://www.fimfiction.net' + ma[1],
        title: entities.decode(ma[2])
      }
      html = html.substring(html.indexOf('<hr />') + 6)
    }

    let endDescPos = html.indexOf('</span>\n')
    let description = html.substring(0, endDescPos).trim()
    this.description = description

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

    matchTag = /<a href="\/tag\/(.*?)" class="character_icon" title="(.*?)" style=".*?"><img src="(.*?)" class="character_icon" \/><\/a>/g
    for (let tag; (tag = matchTag.exec(html));) {
      let t = {
        url: 'http://www.fimfiction.net/tag/' + tag[1],
        filename: 'tag-' + tag[1],
        name: entities.decode(tag[2]),
        image: entities.decode(tag[3])
      }
      tags.push(t)
      tags.byImage[t.image] = t
      this.remoteResources.set(t.image, {filename: t.filename, originalUrl: t.image, where: ['tags']})
    }
    this.tags = tags
  }

  parseChapterPage (html) {
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

    let chapterPos = html.indexOf('<div class="bbcode">')
    let chapter = html.substring(chapterPos + 20)

    let pos = chapter.indexOf('\t\t</div>\n\t</div>\t\t\n\t\t\t\t\t</div>\n')

    chapter = chapter.substring(0, pos).trim()

    // remove leading and trailing <br /> tags and whitespace
    chapter = chapter.replace(trimWhitespace, '')
    return {content: chapter, notes: authorNotes, notesFirst: authorNotesPos < chapterPos}
  }

  replaceRemoteResources () {
    if (!this.options.includeExternal) {
      this.remoteResources.forEach((r, url) => {
        if (r.originalUrl && r.where) {
          let ourl = new RegExp(escapeStringRegexp(r.originalUrl), 'g')
          for (var i = 0; i < r.where.length; i++) {
            let w = r.where[i]
            if (typeof w === 'number') {
              if (ourl.test(this.chapters[w])) {
                this.storyInfo.chapters[w].remote = true
              }
            } else if (w === 'description') {
              if (ourl.test(this.storyInfo.description)) {
                this.hasRemoteResources.titlePage = true
              }
            } else if (w === 'tags') {
              this.hasRemoteResources.titlePage = true
            }
          }
        }
      })
    } else {
      this.remoteResources.forEach((r, url) => {
        let dest = '../' + r.dest
        if (r.dest && r.originalUrl && r.where) {
          let ourl = new RegExp(escapeStringRegexp(r.originalUrl), 'g')
          for (var i = 0; i < r.where.length; i++) {
            let w = r.where[i]
            if (typeof w === 'object' && w.chapter !== undefined && this.chaptersHtml[w.chapter]) {
              this.chaptersHtml[w.chapter] = this.chaptersHtml[w.chapter].replace(ourl, dest)
            } else if (typeof w === 'object' && w.note !== undefined && this.notesHtml[w.note]) {
              this.notesHtml[w.note] = this.notesHtml[w.note].replace(ourl, dest)
            } else if (w === 'description') {
              this.storyInfo.description = this.storyInfo.description.replace(ourl, dest)
            } else if (w === 'tags') {
              this.tags.byImage[r.originalUrl].image = dest
            }
          }
        }
      })
    }
  }
}

module.exports = FimFic2Epub
