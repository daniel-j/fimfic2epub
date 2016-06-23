
import m from 'mithril'
import render from './lib/mithril-node-render'
import { XmlEntities } from 'html-entities'
import tidy from 'exports?tidy_html5!tidy-html5'
import zeroFill from 'zero-fill'

import { NS, tidyOptions } from './constants'

const entities = new XmlEntities()

export default function parseChapter (num, ch, html, remoteResources, callback) {
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

  chapterPage = chapterPage.replace(/<div class="youtube_container">(.+?)<\/div>/g, (match, contents) => {
    // console.log(match, contents)
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
  let matchUrl = /<img src="(.+?)"[^>]*>/g

  for (let ma; (ma = matchUrl.exec(chapterPage));) {
    let url = ma[1]
    let cleanurl = decodeURI(entities.decode(url))
    if (remoteResources.has(cleanurl)) {
      continue
    }
    let filename = 'ch_' + zeroFill(3, num + 1) + '_' + remoteCounter
    remoteCounter++
    remoteResources.set(cleanurl, {filename: filename, chapter: num, originalUrl: url})
  }

  callback(chapterPage)
}
