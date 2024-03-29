
import JSZip from 'jszip'
import escapeStringRegexp from 'escape-string-regexp'
import zeroFill from 'zero-fill'
import { decode } from 'html-entities'
import sanitize from 'sanitize-filename'
import { URL } from 'url'
import isNode from 'detect-node'
import FileType from 'file-type'
import isSvg from 'is-svg'
import sizeOf from 'image-size'
import EventEmitter from 'events'
import { buf as crc32 } from 'crc-32'

import { cleanMarkup } from './cleanMarkup'
import fetch from './fetch'
import fetchRemote from './fetchRemote'
import * as template from './templates'
import { styleCss, coverstyleCss, titlestyleCss, iconsCss, navstyleCss, paragraphsCss } from './styles'
import * as utils from './utils'
import kepubify from './kepubify'
import subsetFont from './subsetFont'

import { containerXml } from './constants'

const fontAwesomeCodes = require('../build/font-awesome-codes.json')

const trimWhitespace = /^\s*(<br\s*\/?\s*>)+|(<br\s*\/?\s*>)+\s*$/ig

class FimFic2Epub extends EventEmitter {
  static getStoryId (id) {
    if (isNaN(id)) {
      const url = new URL(id)
      if (url.hostname === 'www.fimfiction.net' || url.hostname === 'fimfiction.net') {
        const m = url.pathname.match(/^\/story\/(\d+)/)
        if (m) {
          id = m[1]
        }
      }
    }
    return id
  }

  static getFilename (storyInfo) {
    return sanitize(storyInfo.author.name + ' - ' + storyInfo.title + '.epub')
  }

  static fetchStoryInfo (storyId, raw = false) {
    return new Promise((resolve, reject) => {
      storyId = FimFic2Epub.getStoryId(storyId)
      const url = '/api/story.php?story=' + storyId
      fetch(url).then((content) => {
        let data
        try {
          data = JSON.parse(content)
        } catch (e) {}
        if (!data) {
          reject(new Error('Unable to fetch story info'))
          return
        }
        if (data.error) {
          reject(new Error(data.error + ' (id: ' + storyId + ')'))
          return
        }
        const story = data.story
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

  constructor (storyId, options = {}) {
    super()

    this.storyId = FimFic2Epub.getStoryId(storyId)

    this.defaultOptions = {
      typogrify: false,
      addCommentsLink: true,
      includeAuthorNotes: true,
      useAuthorNotesIndex: false,
      showChapterHeadings: true,
      showChapterWordCount: true,
      showChapterDuration: true,
      includeExternal: true,
      paragraphStyle: 'spaced',
      kepubify: false,
      joinSubjects: false,
      calculateReadingEase: true,
      readingEaseWakeupInterval: isNode ? 50 : 200, // lower for node, to not slow down thread
      wordsPerMinute: 200, // 0 to disable
      addChapterBars: true
    }

    this.options = Object.assign(this.defaultOptions, options)

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
    this.pages = {}
    this.remoteResourcesCached = false
    this.remoteResources = new Map()
    this.usedIcons = new Set()
    this.iconsFont = null
    this.coverUrl = ''
    this.coverImage = null
    this.coverFilename = ''
    this.coverType = ''
    this.coverImageDimensions = { width: 0, height: 0 }
    this.readingEase = null

    this.hasRemoteResources = {
      titlePage: false
    }

    this.cachedFile = null
    this.tags = []

    this.zip = null
  }

  fetchAll () {
    if (this.pcache.fetchAll) {
      return this.pcache.fetchAll
    }

    this.progress(0, 0, '')

    this.pcache.fetchAll = this.fetchMetadata()
      .then(this.fetchChapters.bind(this))
      .then(this.fetchCoverImage.bind(this))
      .then(this.buildChapters.bind(this))
      .then(this.buildPages.bind(this))
      .then(this.findIcons.bind(this))
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

    this.pcache.metadata = FimFic2Epub.fetchStoryInfo(this.storyId)
      .then((storyInfo) => {
        this.storyInfo = storyInfo
        this.storyInfo.uuid = 'urn:fimfiction:' + this.storyInfo.id
        this.filename = FimFic2Epub.getFilename(this.storyInfo)
        this.storyInfo.chapters.forEach((chapter) => {
          if (chapter.date_modified > this.storyInfo.date_modified) {
            this.storyInfo.date_modified = chapter.date_modified
          }
        })
        this.progress(0, 0.5)
      })
      .then(this.fetchTitlePage.bind(this))
      .then(() => {
        this.progress(0, 1)
      })
      .then(() => cleanMarkup(this.description)).then((html) => {
        this.storyInfo.description = html
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

    const chapterCount = this.storyInfo.chapters.length
    const url = '/story/download/' + this.storyInfo.id + '/html'

    this.pcache.chapters = fetch(url).then((html) => {
      let p = Promise.resolve()
      const matchChapter = /<article class="chapter">[\s\S]*?<\/header>([\s\S]*?)<\/article>/g
      for (let ma, i = 0; (ma = matchChapter.exec(html)); i++) {
        const ch = this.storyInfo.chapters[i]
        let chapterContent = ma[1]
        chapterContent = chapterContent.replace(/<footer>[\s\S]*?<\/footer>/g, '').trim()

        const authorNotesPos = chapterContent.indexOf('<aside ')
        let notesContent = ''
        const notesFirst = authorNotesPos === 0
        if (authorNotesPos !== -1) {
          chapterContent = chapterContent.replace(/<aside class="authors-note">([\s\S]*?)<\/aside>/, (match, content, pos) => {
            content = content.replace(/<header><h1>.*?<\/h1><\/header>/, '')
            notesContent = content.trim().replace(trimWhitespace, '')
            return ''
          })
        }

        chapterContent = chapterContent.trim().replace(trimWhitespace, '')
        const chapter = { content: chapterContent, notes: notesContent, notesFirst }
        ch.realWordCount = utils.htmlWordCount(chapter.content)

        p = p.then(() => cleanMarkup(chapter.content).then((content) => {
          chapter.content = content
        }))
        if (chapter.notes) {
          p = p.then(() => cleanMarkup(notesContent).then((notes) => {
            if (!notes) {
              console.log('error notes:', i, notesContent)
            }
            chapter.notes = notes
          }))
        }
        p = p.then(() => {
          this.progress(0, (i + 1) / chapterCount, 'Parsed chapter ' + (i + 1) + ' / ' + chapterCount)
          if (chapter.notes) {
            this.hasAuthorNotes = true
            this.chaptersWithNotes.push(i)
          }
          this.chapters[i] = chapter
          return utils.sleep(0)
        })
      }
      return p
    }).then(() => {
      this.totalWordCount = this.storyInfo.chapters.reduce((count, ch) => count + ch.realWordCount, 0)
      this.pcache.chapters = null
    }).catch((err) => {
      console.error(err)
    })

    return this.pcache.chapters
  }

  fetchRemoteFiles () {
    if (!this.options.includeExternal || this.remoteResources.size === 0) {
      return Promise.resolve()
    }
    if (this.pcache.remoteResources) {
      return this.pcache.remoteResources
    }
    if (this.remoteResourcesCached) {
      return Promise.resolve()
    }

    const checksums = new Map()

    this.progress(0, 0, 'Fetching remote files...')
    this.pcache.remoteResources = new Promise((resolve, reject) => {
      const iter = this.remoteResources.entries()
      let completeCount = 0

      const next = (r) => {
        completeCount++
        if (r.data) {
          this.progress(0, completeCount / this.remoteResources.size, 'Fetched remote file ' + completeCount + ' / ' + this.remoteResources.size)
        } else {
          this.progress(0, completeCount / this.remoteResources.size, 'Fetching remote files...')
        }
        recursive()
      }

      const recursive = () => {
        let r = iter.next().value
        if (!r) {
          if (completeCount === this.remoteResources.size) {
            resolve()
          }
          return
        }
        const url = r[0]
        r = r[1]
        if (r.data) {
          next(r)
          return
        }

        console.log('Remote file URL: ' + url)

        fetchRemote(url, 'arraybuffer').then(async (data) => {
          r.dest = null
          let info = await FileType.fromBuffer(isNode ? data : new Uint8Array(data))
          if (!info || info.mime === 'application/xml') {
            // file-type doesn't support SVG, extra check:
            if (isSvg(Buffer.from(data).toString('utf8'))) {
              info = {
                mime: 'image/svg+xml',
                ext: 'svg'
              }
            }
          }
          if (info) {
            const checksum = crc32(isNode ? data : new Uint8Array(data))
            if (checksums.has(checksum)) {
              const sameFile = this.remoteResources.get(checksums.get(checksum))
              r.dest = sameFile.dest
              r.filename = sameFile.dest
              r.type = sameFile.type
              r.data = sameFile.data
            } else {
              checksums.set(checksum, url)
              const type = info.mime
              r.type = type
              const isImage = type.startsWith('image/')
              const folder = isImage ? 'Images' : 'Misc'
              const dest = folder + '/*.' + info.ext
              r.dest = dest.replace('*', r.filename)
              r.data = data
            }
          }
          next(r)
        }).catch((err) => { console.error(err); next(r) })
      }

      // no concurrent downloads!
      recursive()
    }).then(() => {
      this.pcache.remoteResources = null
    })
    return this.pcache.remoteResources
  }

  async buildPages () {
    this.pages.cover = await template.createCoverPage(this)
    this.pages.title = await template.createTitlePage(this)
    this.findRemoteResources('titlepage', 'titlepage', this.pages.title)
    this.pages.nav = await template.createNav(this)
    delete this.pages.notesnav
    if (this.options.includeAuthorNotes && this.options.useAuthorNotesIndex && this.hasAuthorNotes) {
      this.pages.notesnav = await template.createNotesNav(this)
    }
    if (this.options.kepubify) {
      this.pages.nav = kepubify(this.pages.nav)
      this.pages.title = kepubify(this.pages.title)
      if (this.pages.notesnav) {
        this.pages.notesnav = kepubify(this.pages.notesnav)
      }
    }
  }

  buildChapters () {
    let chain = Promise.resolve()
    this.chaptersHtml.length = 0
    this.notesHtml.length = 0

    for (let i = 0; i < this.chapters.length; i++) {
      const ch = this.storyInfo.chapters[i]
      const chapter = this.chapters[i]
      let content = chapter.content

      if (this.options.typogrify) {
        content = utils.typogrify(content)
      }

      chain = chain.then(template.createChapter.bind(null, this, {
        title: ch.title,
        showHeadings: this.options.showChapterHeadings,
        showWordCount: this.options.showChapterWordCount,
        showDuration: this.options.showChapterDuration,
        link: this.options.addCommentsLink ? ch.link : null,
        linkNotes: this.options.includeAuthorNotes && this.options.useAuthorNotesIndex && chapter.notes ? 'note_' + zeroFill(3, i + 1) + '.xhtml' : null,
        content: content,
        notes: this.options.includeAuthorNotes && !this.options.useAuthorNotesIndex ? chapter.notes : '',
        notesFirst: chapter.notesFirst,
        index: i
      })).then((html) => {
        this.findRemoteResources('ch_' + zeroFill(3, i + 1), { chapter: i }, html)
        if (this.options.kepubify) {
          html = kepubify(html)
        }
        this.chaptersHtml[i] = html
      })
      if (this.options.includeAuthorNotes && this.options.useAuthorNotesIndex && chapter.notes) {
        chain = chain.then(template.createChapter.bind(null, this, {
          title: 'Author\'s Note: ' + ch.title,
          showHeadings: true,
          content: chapter.notes,
          index: i
        }, true)).then((html) => {
          this.findRemoteResources('note_' + zeroFill(3, i + 1), { note: i }, html)
          if (this.options.kepubify) {
            html = kepubify(html)
          }
          this.notesHtml[i] = html
        })
      }
      chain = chain
        .then(() => {
          this.progress(0, ((i + 1) / this.chapters.length) * 0.99, 'Processed chapter ' + (i + 1) + ' / ' + this.chapters.length)
          return utils.sleep(0)
        })
    }

    chain = chain.then(async () => {
      if (this.options.calculateReadingEase && !this.readingEase) {
        const content = this.chapters.reduce((str, ch) => {
          return str + utils.htmlToText(ch.content) + '\n\n'
        }, '')
        this.progress(0, 0, 'Calculating Flesch reading ease...')
        this.readingEase = await utils.readingEase(
          content, this.options.readingEaseWakeupInterval,
          (progress) => {
            this.progress(0, progress * 0.99, 'Calculating Flesch reading ease ' + Math.round(progress * 100) + '%')
          }
        )
      }
    })

    return chain
  }

  async build () {
    this.cachedFile = null
    this.zip = null

    this.replaceRemoteResources()

    this.zip = new JSZip()

    this.zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
    this.zip.file('META-INF/container.xml', containerXml)

    this.zip.file('OEBPS/content.opf', Buffer.from(await template.createOpf(this), 'utf8'))

    if (this.coverImage) {
      this.zip.file('OEBPS/' + this.coverFilename, Buffer.from(this.coverImage))
    }

    this.zip.file('OEBPS/Text/cover.xhtml', Buffer.from(this.pages.cover, 'utf8'))
    this.zip.file('OEBPS/Styles/coverstyle.css', Buffer.from(coverstyleCss, 'utf8'))

    this.zip.file('OEBPS/Text/title.xhtml', Buffer.from(this.pages.title, 'utf8'))
    this.zip.file('OEBPS/Styles/titlestyle.css', Buffer.from(titlestyleCss, 'utf8'))

    this.zip.file('OEBPS/nav.xhtml', Buffer.from(this.pages.nav, 'utf8'))
    this.zip.file('OEBPS/toc.ncx', Buffer.from(await template.createNcx(this), 'utf8'))
    this.zip.file('OEBPS/Styles/navstyle.css', Buffer.from(navstyleCss, 'utf8'))

    for (let i = 0; i < this.chapters.length; i++) {
      const filename = 'OEBPS/Text/chapter_' + zeroFill(3, i + 1) + '.xhtml'
      const html = this.chaptersHtml[i]
      this.zip.file(filename, Buffer.from(html, 'utf8'))
    }

    if (this.options.includeAuthorNotes && this.options.useAuthorNotesIndex && this.hasAuthorNotes) {
      this.zip.file('OEBPS/notesnav.xhtml', Buffer.from(this.pages.notesnav, 'utf8'))

      for (let i = 0; i < this.chapters.length; i++) {
        if (!this.chapters[i].notes) continue
        const filename = 'OEBPS/Text/note_' + zeroFill(3, i + 1) + '.xhtml'
        const html = this.notesHtml[i]
        this.zip.file(filename, Buffer.from(html, 'utf8'))
      }
    }

    if (this.iconsFont) {
      this.zip.file('OEBPS/Fonts/fontawesome-webfont-subset.ttf', this.iconsFont)
    }

    this.zip.file('OEBPS/Styles/style.css', Buffer.from(
      styleCss + '\n\n' + this.iconsStyle() + '\n\n' +
      (paragraphsCss[this.options.paragraphStyle] || '')
      , 'utf8'))

    const remoteDestCache = new Set()
    this.remoteResources.forEach((r) => {
      if (r.dest && !remoteDestCache.has(r.dest)) {
        this.zip.file('OEBPS/' + r.dest, r.data)
        remoteDestCache.add(r.dest)
      }
    })
    remoteDestCache.clear()
  }

  // for node, resolve a Buffer, in browser resolve a Blob
  getFile () {
    if (!this.zip) {
      return Promise.reject(new Error('Not downloaded.'))
    }
    if (this.cachedFile) {
      return Promise.resolve(this.cachedFile)
    }

    this.progress(0, 0, 'Compressing...')

    let lastPercent = -1

    return this.zip
      .generateAsync({
        type: isNode ? 'nodebuffer' : 'blob',
        mimeType: 'application/epub+zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      }, (metadata) => { // onUpdate
        const currentPercent = Math.round(metadata.percent / 10) * 10
        if (lastPercent !== currentPercent) {
          lastPercent = currentPercent
          this.progress(0, currentPercent / 100, 'Compressing...')
        }
      })
      .then((file) => {
        this.progress(0, 1, 'Complete!')
        this.cachedFile = file
        return file
      })
      .catch((err) => {
        console.error(err)
      })
  }

  // example usage: .pipe(fs.createWriteStream(filename))
  streamFile (onUpdate) {
    if (!this.zip) {
      return null
    }
    this.progress(0, 0, 'Compressing...')

    let lastPercent = -1

    return this.zip
      .generateNodeStream({
        type: 'nodebuffer',
        streamFiles: false,
        mimeType: 'application/epub+zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      }, (metadata) => {
        if (onUpdate) onUpdate(metadata)
        const currentPercent = Math.round(metadata.percent / 20) * 20
        if (lastPercent !== currentPercent) {
          lastPercent = currentPercent
          this.progress(0, currentPercent / 100, 'Compressing...')
        }
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

  async setCoverImage (buffer) {
    buffer = isNode ? buffer : Buffer.from(new Uint8Array(buffer))
    const info = await FileType.fromBuffer(buffer)
    if (!info || !info.mime.startsWith('image/')) {
      throw new Error('Invalid image')
    }
    this.coverImage = buffer
    this.coverFilename = 'Images/cover.' + info.ext
    this.coverType = info.mime
    this.coverImageDimensions = sizeOf(Buffer.from(buffer))
    return this.coverImage
  }

  // Internal/private methods
  progress (part, percent, status = '') {
    // let parts = 6.3
    // let partsize = 1 / parts
    // percent = (part / parts) + percent * partsize
    try {
      this.emit('progress', percent, status)
    } catch (err) {
      console.error(err)
    }
    if (status) {
      console.log(status)
    }
  }

  findRemoteResources (prefix, where, html) {
    let remoteCounter = 1
    const matchUrl = /<img.*?src="([^">]*\/([^">]*?))".*?>/g
    const emoticonUrl = /static\.fimfiction\.net\/images\/emoticons\/([a-z_]*)\.[a-z]*$/

    for (let ma; (ma = matchUrl.exec(html));) {
      const url = ma[1]
      const cleanurl = decode(url, { level: 'xml' })
      if (this.remoteResources.has(cleanurl)) {
        const r = this.remoteResources.get(cleanurl)
        if (r.where.indexOf(where) === -1) {
          r.where.push(where)
        }
        continue
      }
      let filename = prefix + '_' + remoteCounter
      const emoticon = url.match(emoticonUrl)
      if (emoticon) {
        filename = 'emoticon_' + emoticon[1]
      }
      remoteCounter++
      this.remoteResources.set(cleanurl, { filename: filename, where: [where], originalUrl: url })
    }
  }

  async findIcons () {
    const matchIcon = /<i class="fa fa-fw fa-(.*?)"/g
    this.usedIcons.clear()

    const scan = (html) => {
      if (!html) return
      for (let ma; (ma = matchIcon.exec(html));) {
        if (ma[1] in fontAwesomeCodes) {
          this.usedIcons.add(ma[1])
        } else {
          console.warn('Unknown icon:', ma[1])
        }
      }
    }

    scan(this.pages.title)
    this.chaptersHtml.forEach(scan)
    this.notesHtml.forEach(scan)

    if (this.usedIcons.size === 0) {
      this.iconsFont = null
      return
    }

    const glyphs = [...this.usedIcons].map((name) => {
      return fontAwesomeCodes[name].charCodeAt(0)
    })
    const fontFile = require('font-awesome/fonts/fontawesome-webfont.ttf')
    this.iconsFont = await subsetFont(fontFile, glyphs, { local: isNode })
  }

  iconsStyle () {
    if (this.usedIcons.size === 0) return ''
    let style = iconsCss.trim() + '\n'
    this.usedIcons.forEach((name) => {
      style += '.fa-' + name + ':before { content: "\\' + fontAwesomeCodes[name].charCodeAt(0).toString(16) + '"; }\n'
    })
    return style
  }

  fetchCoverImage () {
    if (this.pcache.coverImage) {
      return this.pcache.coverImage
    }

    if (this.coverImage) {
      return Promise.resolve(this.coverImage)
    }
    this.coverImage = null
    const url = this.coverUrl || this.storyInfo.full_image
    if (!url) {
      console.warn('Story has no image. Generating one...')
      let canvas
      if (isNode) {
        canvas = require('canvas').createCanvas(1080, 1440)
      } else {
        canvas = document.createElement('canvas')
        canvas.width = 1080
        canvas.height = 1440
      }
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = 'black'
      ctx.textAlign = 'center'
      ctx.strokeStyle = 'black'

      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)
      ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24)

      const title = this.storyInfo.title
      const author = this.storyInfo.author.name

      let fontSize = 150
      let width
      do {
        ctx.font = 'bold ' + fontSize + 'px sans-serif'
        width = ctx.measureText(title).width
        fontSize -= 5
      } while (width > canvas.width * 0.85)

      ctx.fillText(title, canvas.width / 2, canvas.height * 0.2)
      fontSize = 75
      do {
        ctx.font = fontSize + 'px sans-serif'
        width = ctx.measureText(author).width
        fontSize -= 5
      } while (width > canvas.width * 0.7)

      ctx.fillText(author, canvas.width / 2, canvas.height * 0.9)

      return this.setCoverImage(Buffer.from(canvas.toDataURL('image/jpeg').split(',')[1], 'base64'))
    }

    this.progress(0, 0, 'Fetching cover image...')

    this.pcache.coverImage = fetchRemote(url, 'arraybuffer').then(async (data) => {
      data = isNode ? data : new Uint8Array(data)
      const info = await FileType.fromBuffer(data)
      if (info) {
        const type = info.mime
        const isImage = type.startsWith('image/')
        if (!isImage) {
          return null
        }
        const filename = 'Images/cover.' + info.ext
        this.coverFilename = filename
        this.coverType = type

        this.coverImageDimensions = sizeOf(Buffer.from(data))
        this.coverImage = data
        this.coverFilename = filename
        return this.coverImage
      } else {
        return null
      }
    }).then((data) => {
      this.pcache.coverImage = null
      return data
    })
    return this.pcache.coverImage
  }

  fetchTitlePage () {
    let viewMature = true
    const isStoryMature = this.storyInfo.content_rating === 2
    if (!isNode) {
      viewMature = document.cookie.split('; ').includes('view_mature=true')
      if (!viewMature && isStoryMature) {
        if (window.setCookie) {
          window.setCookie('view_mature', true, 365)
        } else {
          document.cookie = 'view_mature=true; path=/'
        }
      }
    }
    return fetch(this.storyInfo.url).then((data) => {
      if (!viewMature && isStoryMature) {
        // Delete cookie
        document.cookie = 'view_mature=false; path=/; Max-Age=0'
      }
      return data
    }).then(this.extractTitlePageInfo.bind(this))
  }

  extractTitlePageInfo (html) {
    let startTagsPos = html.indexOf('<div class="story_content_box"')
    startTagsPos += html.substring(startTagsPos).indexOf('<ul class="story-tags">') + 23
    let tagsHtml = html.substring(startTagsPos)

    const endTagsPos = tagsHtml.indexOf('</ul>')
    tagsHtml = tagsHtml.substring(0, endTagsPos)

    const tags = []
    let c
    tags.byImage = {}
    this.subjects.length = 0
    this.subjects.push('Fimfiction')
    this.subjects.push(this.storyInfo.content_rating_text)

    const matchTag = /<a href="([^"]*?)" class="([^"]*?)" title="[^"]*?" data-tag="([^"]*?)".*?>(.*?)<\/a>/g
    for (;(c = matchTag.exec(tagsHtml));) {
      const cat = {
        url: 'https://www.fimfiction.net' + c[1],
        className: 'story-tag ' + c[2],
        name: decode(c[4], { level: 'xml' }),
        type: c[2].replace('tag-', '')
      }
      tags.push(cat)
      this.subjects.push(cat.name)
    }
    this.tags = tags

    html = html.substring(endTagsPos + 5)
    html = html.substring(html.indexOf('<span class="description-text bbcode">') + 38)

    let ma = html.match(/This story is a sequel to <a href="([^"]*)">(.*?)<\/a>/)
    if (ma) {
      this.storyInfo.prequel = {
        url: 'https://www.fimfiction.net' + ma[1],
        title: decode(ma[2], { level: 'xml' })
      }
      html = html.substring(html.indexOf('<hr />') + 6)
    }

    const endDescPos = html.indexOf('</span>\n')
    const description = html.substring(0, endDescPos).trim()
    this.description = description

    html = html.substring(endDescPos + 7)
    const extraPos = html.indexOf('<div class="extra_story_data">')
    html = html.substring(extraPos + 30)

    ma = html.match(/<span class="approved-date">.*?data-time="(.*?)".*?<\/span>/)
    if (ma) {
      this.storyInfo.publishDate = +ma[1]
    }

    html = html.substring(0, html.indexOf('<div class="button-group"'))
  }

  parseChapterPage (html) {
    const trimWhitespace = /^\s*(<br\s*\/?\s*>)+|(<br\s*\/?\s*>)+\s*$/ig

    let authorNotesPos = html.indexOf('<div class="authors-note"')
    let authorNotes = ''
    if (authorNotesPos !== -1) {
      authorNotesPos = authorNotesPos + html.substring(authorNotesPos).indexOf('<b>Author\'s Note:</b>')
      authorNotes = html.substring(authorNotesPos + 22)
      authorNotes = authorNotes.substring(0, authorNotes.indexOf('\t\n\t</div>'))
      authorNotes = authorNotes.trim()
      authorNotes = authorNotes.replace(trimWhitespace, '')
    }

    const chapterPos = html.indexOf('<div class="bbcode">')
    let chapter = html.substring(chapterPos + 20)

    const pos = chapter.indexOf('\t\t</div>\n\t</div>\t\t\n\t\t\t\t\t</div>\n')

    chapter = chapter.substring(0, pos).trim()

    // remove leading and trailing <br /> tags and whitespace
    chapter = chapter.replace(trimWhitespace, '')
    return { content: chapter, notes: authorNotes, notesFirst: authorNotesPos < chapterPos }
  }

  replaceRemoteResources () {
    if (this.remoteResources.size === 0) return
    if (!this.options.includeExternal) {
      this.remoteResources.forEach((r, url) => {
        if (r.originalUrl && r.where) {
          const ourl = new RegExp(escapeStringRegexp(r.originalUrl), 'g')
          for (var i = 0; i < r.where.length; i++) {
            const w = r.where[i]
            if (typeof w === 'number') {
              if (ourl.test(this.chapters[w])) {
                this.storyInfo.chapters[w].remote = true
              }
            } else if (w === 'titlepage') {
              if (ourl.test(this.pages.title)) {
                this.hasRemoteResources.titlePage = true
              }
            }
          }
        }
      })
    } else {
      this.remoteResources.forEach((r, url) => {
        if (r.dest && r.originalUrl && r.where) {
          const dest = '../' + r.dest
          const ourl = new RegExp(escapeStringRegexp(r.originalUrl), 'g')
          for (var i = 0; i < r.where.length; i++) {
            const w = r.where[i]
            if (typeof w === 'object' && w.chapter !== undefined && this.chaptersHtml[w.chapter]) {
              this.chaptersHtml[w.chapter] = this.chaptersHtml[w.chapter].replace(ourl, dest)
            } else if (typeof w === 'object' && w.note !== undefined && this.notesHtml[w.note]) {
              this.notesHtml[w.note] = this.notesHtml[w.note].replace(ourl, dest)
            } else if (w === 'titlepage') {
              this.pages.title = this.pages.title.replace(ourl, dest)
            }
          }
        } else {
          console.log('bad remote', r, url)
        }
      })
    }
  }
}

export default FimFic2Epub
