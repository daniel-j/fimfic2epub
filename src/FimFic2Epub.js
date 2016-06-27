
import JSZip from 'jszip'
import escapeStringRegexp from 'escape-string-regexp'
import { saveAs } from 'file-saver'
import zeroFill from 'zero-fill'
import { XmlEntities } from 'html-entities'

import isNode from 'detect-node'

import { styleCss, coverstyleCss, titlestyleCss } from './styles'

import { cleanMarkup } from './cleanMarkup'
import fetchRemote from './fetchRemote'
import * as template from './templates'

import { mimeMap, containerXml } from './constants'

const entities = new XmlEntities()

function blobToDataURL (blob, callback) {
  let a = new FileReader()
  a.onloadend = function (e) { callback(a.result) }
  a.readAsDataURL(blob)
}

export default class FimFic2Epub {

  constructor (storyId) {
    this.storyId = storyId
    this.isDownloading = false
    this.zip = null
    this.chapterContent = []
    this.remoteResources = new Map()
    this.storyInfo = null
    this.isDownloading = false
    this.cachedBlob = null
    this.hasCoverImage = false
    this.includeTitlePage = true
    this.categories = []
    this.tags = []
  }

  download () {
    if (this.isDownloading) {
      alert("Calm down, I'm working on it (it's processing)")
      return
    }
    if (this.cachedBlob) {
      this.saveStory()
      return
    }
    this.build()
  }

  build () {
    this.isDownloading = true

    this.zip = new JSZip()
    this.zip.file('mimetype', 'application/epub+zip')
    this.zip.file('META-INF/container.xml', containerXml)

    console.log('Fetching story metadata...')

    fetchRemote('https://www.fimfiction.net/api/story.php?story=' + this.storyId, (raw, type) => {
      let data
      try {
        data = JSON.parse(raw)
      } catch (e) {
        console.log('Unable to fetch story json')
        return
      }
      if (data.error) {
        console.error(data.error)
        return
      }
      this.storyInfo = data.story
      this.storyInfo.chapters = this.storyInfo.chapters || []
      this.storyInfo.uuid = 'urn:fimfiction:' + this.storyInfo.id

      this.zip.file('Styles/style.css', styleCss)
      this.zip.file('Styles/coverstyle.css', coverstyleCss)
      if (this.includeTitlePage) {
        this.zip.file('Styles/titlestyle.css', titlestyleCss)
      }

      this.zip.file('toc.ncx', template.createNcx(this))
      this.zip.file('Text/nav.xhtml', template.createNav(this))

      this.fetchTitlePage()
    })
  }

  fetchTitlePage () {
    fetchRemote(this.storyInfo.url, (raw, type) => {
      this.extractTitlePageInfo(raw, () => this.checkCoverImage())
    })
  }

  extractTitlePageInfo (html, cb) {
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
        this.remoteResources.set(t.image, {filename: 'tag_' + tag[1], originalUrl: t.image, where: ['tags']})
      }
    }
    this.tags = tags

    cleanMarkup(description, (html) => {
      this.storyInfo.description = html
      this.findRemoteResources('description', 'description', html)
      cb()
    })
  }

  checkCoverImage () {
    this.hasCoverImage = !!this.storyInfo.full_image

    if (this.hasCoverImage) {
      this.remoteResources.set(this.storyInfo.full_image, {filename: 'cover', where: ['cover']})

      if (!isNode) {
        let coverImage = new Image()
        coverImage.src = this.storyInfo.full_image

        coverImage.addEventListener('load', () => {
          this.processStory(coverImage)
        }, false)
      } else {
        fetchRemote(this.storyInfo.full_image, (data, type) => {
          this.processStory(process.sizeOf(data))
        }, 'buffer')
      }
    } else {
      this.processStory()
    }
  }

  processStory (coverImage) {
    console.log('Fetching chapters...')

    this.fetchChapters(() => {
      this.fetchRemoteFiles(() => {
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
          let filename = 'Text/chapter_' + zeroFill(3, num + 1) + '.xhtml'
          this.zip.file(filename, html)
        }

        this.chapterContent.length = 0

        if (this.includeTitlePage) {
          this.zip.file('Text/title.xhtml', template.createTitlePage(this))
        }

        if (this.hasCoverImage) {
          this.zip.file('Text/cover.xhtml', template.createCoverPage(coverFilename, coverImage.width, coverImage.height))
        } else {
          this.zip.file('Text/cover.xhtml', template.createCoverPage(this))
        }

        this.zip.file('content.opf', template.createOpf(this))

        console.log('Packaging epub...')

        if (!isNode) {
          this.zip
          .generateAsync({
            type: 'blob',
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE',
            compressionOptions: {level: 9}
          })
          .then((blob) => {
            this.cachedBlob = blob
            this.isDownloading = false
            this.saveStory()
          })
        } else {
          this.zip
          .generateNodeStream({
            type: 'nodebuffer',
            streamFiles: true,
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE',
            compressionOptions: {level: 9}
          })
          .pipe(process.fs.createWriteStream(this.storyInfo.title + ' by ' + this.storyInfo.author.name + '.epub'))
          .on('finish', () => {
            console.log('Saved epub')
          })
        }
      })
    })
  }

  fetchRemoteFiles (cb) {
    let iter = this.remoteResources.entries()
    let count = 0
    let completeCount = 0

    let recursive = () => {
      let r = iter.next().value
      if (!r) {
        if (completeCount === this.remoteResources.size) {
          cb()
        }
        return
      }
      let url = r[0]
      r = r[1]

      console.log('Fetching remote file ' + (count + 1) + ' of ' + this.remoteResources.size + ': ' + r.filename, url)
      count++

      fetchRemote(url, (data, type) => {
        r.dest = null
        r.type = type
        let dest = mimeMap[type]

        if (dest) {
          r.dest = dest.replace('*', r.filename)
          this.zip.file(r.dest, data)
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
  }

  fetchChapters (cb) {
    let chapters = this.storyInfo.chapters
    let chapterCount = this.storyInfo.chapters.length
    let currentChapter = 0
    let completeCount = 0

    if (chapterCount === 0) {
      cb()
      return
    }

    let recursive = () => {
      let index = currentChapter++
      let ch = chapters[index]
      if (!ch) {
        return
      }
      console.log('Fetching chapter ' + (index + 1) + ' of ' + chapters.length + ': ' + ch.title)
      fetchRemote(ch.link.replace('http', 'https'), (html) => {
        template.createChapter(ch, html, (html) => {
          this.findRemoteResources('ch_' + zeroFill(3, index + 1), index, html)
          this.chapterContent[index] = html
          completeCount++
          if (completeCount < chapterCount) {
            recursive()
          } else {
            cb()
          }
        })
      })
    }

    // concurrent downloads!
    recursive()
    recursive()
    recursive()
    recursive()
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

  saveStory () {
    console.log('Saving epub...')
    if (typeof safari !== 'undefined') {
      blobToDataURL(this.cachedBlob, (dataurl) => {
        document.location.href = dataurl
        alert('Rename downloaded file to .epub')
      })
    } else {
      saveAs(this.cachedBlob, this.storyInfo.title + ' by ' + this.storyInfo.author.name + '.epub')
    }
  }
}
