
import m from 'mithril'
import { XmlEntities } from 'html-entities'
import twemoji from 'twemoji'
import render from 'mithril-node-render'

import fetch from './fetch'
import { youtubeKey } from './constants'
import { replaceAsync } from './utils'

const entities = new XmlEntities()

export async function cleanMarkup (html) {
  if (!html) {
    return Promise.resolve('')
  }

  html = twemoji.parse(html, {ext: '.svg', folder: 'svg'})

  // replace HTML entities with decimal entities
  html = html.replace(/\xA0/ig, '&#160;')
  html = html.replace(/&nbsp;/ig, '&#160;')
  html = html.replace(/&emsp;/ig, '&#8195;')

  // fix some tags
  html = html.replace(/<u>/ig, '<span style="text-decoration: underline">')
  html = html.replace(/<\/u>/ig, '</span>')
  html = html.replace(/<s>/ig, '<span style="text-decoration: line-through">')
  html = html.replace(/<\/s>/ig, '</span>')
  html = html.replace(/<span style="font-variant-caps:small-caps">/ig, '<span class="smcp">')

  html = html.replace(/<p>\s*/ig, '<p>')
  html = html.replace(/\s*<\/p>/ig, '</p>')

  // html = fixParagraphIndent(html)

  html = fixDoubleSpacing(html)

  // fix floating blockquote tags
  html = html.replace('<blockquote style="margin: 10px 0px; box-sizing:border-box; -moz-box-sizing:border-box;margin-right:25px; padding: 15px;background-color: #F7F7F7;border: 1px solid #AAA;width: 50%;float:left;box-shadow: 5px 5px 0px #EEE;">', '<blockquote class="left_insert">')
  html = html.replace('<blockquote style="margin: 10px 0px; box-sizing:border-box; -moz-box-sizing:border-box;margin-left:25px; padding: 15px;background-color: #F7F7F7;border: 1px solid #AAA;width: 50%;float:right;box-shadow: 5px 5px 0px #EEE;">', '<blockquote class="right_insert">')

  /*
  let imageEmbed = /<img data-src="(.*?)" class="user_image" src="(.*?)" data-lightbox\/>/g
  html = await replaceAsync(html, imageEmbed, (match, originalUrl, cdnUrl) => {
    return render(m('img', {src: entities.decode(cdnUrl), alt: 'Image'}), {strict: true})
  })
  */

  // Fix links pointing to pages on fimfiction
  // Example: <a href="/user/djazz" rel="nofollow">djazz</a>
  let matchLink = /(<a .?href=")(.+?)(".+?>)/g
  html = html.replace(matchLink, (match, head, url, tail) => {
    if (url.substring(0, 1) !== '#' && url.substring(0, 2) !== '//' && url.substring(0, 4) !== 'http') {
      if (url.substring(0, 1) === '/') {
        url = 'https://fimfiction.net' + entities.decode(url)
      } else {
        // do something else
      }
    }

    return head + url + tail
  })

  let cache = new Map()
  let completeCount = 0

  let matchYouTube = /<p><a class="embed" href="https:\/\/www\.youtube\.com\/watch\?v=(.*?)">.*?<\/a><\/p>/g
  for (let ma; (ma = matchYouTube.exec(html));) {
    let youtubeId = ma[1]
    cache.set(youtubeId, null)
  }

  let matchSoundCloud = /<p><a class="embed" href="(https:\/\/soundcloud\.com\/.*?)">.*?<\/a><\/p>/g
  html = await replaceAsync(html, matchSoundCloud, (match, url) => {
    return render(m('.soundcloud.leftalign', [
      'SoundCloud: ', m('a', {href: entities.decode(url), rel: 'nofollow'}, url.replace('https://soundcloud.com/', '').replace(/[-_]/g, ' ').replace('/', ' - ').replace(/ {2}/g, ' '))
    ]), {strict: true})
  })

  if (cache.size === 0) {
    return html
  } else {
    return getYoutubeInfo([...cache.keys()])
  }

  async function getYoutubeInfo (ids) {
    return fetch('https://www.googleapis.com/youtube/v3/videos?id=' + ids + '&part=snippet&maxResults=50&key=' + youtubeKey).then(async (raw) => {
      let data = []
      try {
        data = JSON.parse(raw).items
      } catch (e) {}
      if (!data) {
        data = []
      }
      data.forEach((video) => {
        cache.set(video.id, video.snippet)
        completeCount++
      })
      if (completeCount === cache.size || data.length === 0) {
        html = await replaceAsync(html, matchYouTube, replaceYouTube)
        return html
      }
    })
  }

  function replaceYouTube (match, id) {
    let youtubeId = id
    let thumbnail = 'https://img.youtube.com/vi/' + youtubeId + '/hqdefault.jpg'
    let youtubeUrl = 'https://youtube.com/watch?v=' + youtubeId
    let title = 'Youtube Video'
    let caption = ''
    let data = cache.get(youtubeId)
    if (data) {
      thumbnail = (data.thumbnails.standard || data.thumbnails.high || data.thumbnails.medium || data.thumbnails.default).url
      title = data.title
      caption = data.title + ' on YouTube'
    } else {
      return Promise.resolve('')
    }
    return render(m('figure.youtube', [
      m('a', {href: youtubeUrl, rel: 'nofollow'},
        m('img', {src: thumbnail, alt: title})
      ),
      m('figcaption', m('a', {href: youtubeUrl, rel: 'nofollow'}, caption))
    ]), {strict: true})
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
  // from FimFictionConverter by Nyerguds
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
