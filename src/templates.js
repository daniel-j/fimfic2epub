
import m from 'mithril'
import render from './lib/mithril-node-render'
import { pd as pretty } from 'pretty-data'
import zeroFill from 'zero-fill'

import { NS } from './constants'

function subjects (s) {
  let list = []
  for (let i = 0; i < s.length; i++) {
    list.push(m('dc:subject', s[i]))
  }
  return list
}

export function createOpf (storyInfo, remoteResources) {
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
      ].concat(subjects(['Pony']))),

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

export function createNcx (storyInfo) {
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

export function createNav (storyInfo) {
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

export function createCoverPage (coverFilename, w, h) {
  let coverPage = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + pretty.xml(render(
    m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
      m('head', [
        m('meta', {name: 'viewport', content: 'width=' + w + ', height=' + h}),
        m('title', 'Cover'),
        m('link', {rel: 'stylesheet', type: 'text/css', href: 'coverstyle.css'})
      ]),
      m('body', {'epub:type': 'cover'}, [
        m('svg#cover', {xmlns: NS.SVG, 'xmlns:xlink': NS.XLINK, version: '1.1', viewBox: '0 0 ' + w + ' ' + h},
          m('image', {width: w, height: h, 'xlink:href': coverFilename})
        )
      ])
    ])
  ))
  // console.log(coverPage)
  return coverPage
}
