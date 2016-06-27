
import m from 'mithril'
import render from './lib/mithril-node-render'
import isNode from 'detect-node'

let tidy
if (!isNode) {
  tidy = require('exports?tidy_html5!tidy-html5')
} else {
  tidy = process.tidy
}

import { tidyOptions } from './constants'

export function cleanMarkup (html, callback) {
  // fix center tags
  html = html.replace(/<center>/g, '<p style="text-align: center;">')
  html = html.replace(/<\/center>/g, '</p>')

  html = html.replace(/<div class="youtube_container">(.+?)<\/div>/g, (match, contents) => {
    // console.log(match, contents)
    let youtubeId = contents.match(/src="https:\/\/www.youtube.com\/embed\/(.+?)"/)[1]
    let thumbnail = 'http://img.youtube.com/vi/' + youtubeId + '/hqdefault.jpg'
    let youtubeUrl = 'https://youtube.com/watch?v=' + youtubeId
    return render(m('a', {href: youtubeUrl, target: '_blank'},
      m('img', {src: thumbnail, alt: 'Youtube Video'})
    ))
  })

  html = html.replace('<blockquote style="margin: 10px 0px; box-sizing:border-box; -moz-box-sizing:border-box;margin-right:25px; padding: 15px;background-color: #F7F7F7;border: 1px solid #AAA;width: 50%;float:left;box-shadow: 5px 5px 0px #EEE;">', '<blockquote class="left_insert">')
  html = html.replace('<blockquote style="margin: 10px 0px; box-sizing:border-box; -moz-box-sizing:border-box;margin-left:25px; padding: 15px;background-color: #F7F7F7;border: 1px solid #AAA;width: 50%;float:right;box-shadow: 5px 5px 0px #EEE;">', '<blockquote class="right_insert">')

  html = fixDoubleSpacing(html)

  html = tidy(`<?xml version="1.0" encoding="utf-8"?>\n` + html, tidyOptions)

  callback(html)
}

export function fixDoubleSpacing (html) {
  // from FimFictionConverter by Nyerguds
  html = html.replace(/\s\s+/g, ' ')
  // push spaces to the closed side of tags
  html = html.replace(/\s+(<[a-z][^>]*>)\s+/g, ' $1')
  html = html.replace(/\s+(<\/[a-z][^>]*>)\s+/g, '$1 ')
  return html
}
