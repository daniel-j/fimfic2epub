
import m from 'mithril'
import render from './lib/mithril-node-render'
import isNode from 'detect-node'

import fetch from './fetch'
import { tidyOptions, youtubeKey } from './constants'

let tidy
if (!isNode) {
  tidy = require('exports?tidy_html5!tidy-html5')
} else {
  tidy = process.tidy
}

export function cleanMarkup (html, callback) {
  // fix center tags
  html = html.replace(/<center>/g, '<p style="text-align: center;">')
  html = html.replace(/<\/center>/g, '</p>')

  // replace HTML non-breaking spaces with normal spaces
  html = html.replace(/&nbsp;/g, ' ')

  html = fixParagraphIndent(html)

  html = fixDoubleSpacing(html)

  let cache = new Map()
  let completeCount = 0

  function getYoutubeInfo (ids) {
    fetch('https://www.googleapis.com/youtube/v3/videos?id=' + ids + '&part=snippet&maxResults=50&key=' + youtubeKey, (raw, type) => {
      let data
      try {
        data = JSON.parse(raw).items
      } catch (e) {

      }
      data.forEach((video) => {
        cache.set(video.id, video.snippet)
        completeCount++
      })
      if (completeCount === cache.size) {
        continueParsing()
      }
    })
  }

  let matchYoutube = /<div class="youtube_container">(.+?)<\/div>/g
  for (let ma; (ma = matchYoutube.exec(html));) {
    let youtubeId = ma[1].match(/src="https:\/\/www.youtube.com\/embed\/(.+?)"/)[1]
    cache.set(youtubeId, null)
  }

  if (cache.size === 0) {
    continueParsing()
  } else {
    getYoutubeInfo([...cache.keys()])
  }

  function continueParsing () {
    html = html.replace(matchYoutube, (match, contents) => {
      // console.log(match, contents)
      let youtubeId = contents.match(/src="https:\/\/www.youtube.com\/embed\/(.+?)"/)[1]
      let thumbnail = 'http://img.youtube.com/vi/' + youtubeId + '/hqdefault.jpg'
      let youtubeUrl = 'https://youtube.com/watch?v=' + youtubeId
      let title = 'Youtube Video'
      let caption = ''
      let data = cache.get(youtubeId)
      if (data) {
        thumbnail = (data.thumbnails.standard || data.thumbnails.high || data.thumbnails.medium || data.thumbnails.default).url
        title = data.title
        caption = data.title + ' on YouTube'
      }
      return render(m('figure.youtube', [
        m('a', {href: youtubeUrl},
          m('img', {src: thumbnail, alt: title})
        ),
        m('figcaption', m('a', {href: youtubeUrl}, caption))
      ]))
    })

    html = html.replace('<blockquote style="margin: 10px 0px; box-sizing:border-box; -moz-box-sizing:border-box;margin-right:25px; padding: 15px;background-color: #F7F7F7;border: 1px solid #AAA;width: 50%;float:left;box-shadow: 5px 5px 0px #EEE;">', '<blockquote class="left_insert">')
    html = html.replace('<blockquote style="margin: 10px 0px; box-sizing:border-box; -moz-box-sizing:border-box;margin-left:25px; padding: 15px;background-color: #F7F7F7;border: 1px solid #AAA;width: 50%;float:right;box-shadow: 5px 5px 0px #EEE;">', '<blockquote class="right_insert">')

    html = tidy(`<?xml version="1.0" encoding="utf-8"?>\n` + html, tidyOptions)

    callback(html)
  }
}

export function fixDoubleSpacing (html) {
  // from FimFictionConverter by Nyerguds
  html = html.replace(/\s\s+/g, ' ')
  // push spaces to the closed side of tags
  html = html.replace(/\s+(<[a-z][^>]*>)\s+/g, ' $1')
  html = html.replace(/\s+(<\/[a-z][^>]*>)\s+/g, '$1 ')
  return html
}

export function fixParagraphIndent (html) {
  // from FimFictionConverter by Nyerguds// from FimFictionConverter by Nyerguds
  let fixIndent = 2
  if (fixIndent > 0) {
    // only trigger indenting when finding as many whitespace characters in a row as indicated by the FixIndent setting.

    // Add indented class, with the search keeping into account that there could be opening tags behind the p tag.
    html = html.replace(new RegExp('<p>((<([^>]+)>)*)\\s{' + fixIndent + '}\\s*', 'g'), '<p class="indented">$1')
    html = html.replace(new RegExp('<p class="(((?!indented)[^>])*)">((<([^>]+)>)*)\\s{' + fixIndent + '}\\s*', 'g'), '<p class="indented $1">$3')

    // Cleanup of remaining start whitespace in already indented paragraphs:
    html = html.replace(/<p([^>]*)>((<[^>]+>)*)\\s+/g, '<p$1>$2')
  }
  return html
}
