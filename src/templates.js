
import m from 'mithril'
import render from './lib/mithril-node-render'
import { pd as pretty } from 'pretty-data'
import zeroFill from 'zero-fill'

import htmlWordCount from './html-wordcount'
import { cleanMarkup } from './cleanMarkup'
import { NS } from './constants'

function nth (d) {
  if (d > 3 && d < 21) return 'th'
  switch (d % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function prettyDate (d) {
  // format: 27th Oct 2011
  let months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return d.getDate() + nth(d) + ' ' + months[d.getMonth()].substring(0, 3) + ' ' + d.getFullYear()
}

export function createChapter (ch, html, callback) {
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

  Promise.all([cleanMarkup(chapter), cleanMarkup(authorNotes)]).then((values) => {
    let [cleanChapter, cleanAuthorNotes] = values

    ch.realWordCount = htmlWordCount(cleanChapter)

    let content = [
      m.trust(cleanChapter),
      cleanAuthorNotes ? m('div#author_notes', {className: authorNotesPos < chapterPos ? 'top' : 'bottom'}, [
        m('p', m('b', 'Author\'s Note:')),
        m.trust(cleanAuthorNotes)]) : null
    ]

    // if author notes are a the beginning of the chapter
    if (cleanAuthorNotes && authorNotesPos < chapterPos) {
      content.reverse()
    }

    let chapterPage = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + pretty.xml(render(
      m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
        m('head', [
          m('meta', {charset: 'utf-8'}),
          m('link', {rel: 'stylesheet', type: 'text/css', href: '../Styles/style.css'}),
          m('title', ch.title)
        ]),
        m('body', [
          m('.chapter-title', [
            m('h1', ch.title),
            m('hr')
          ]),
          content,
          m('p.double', {style: 'text-align: center; clear: both;'},
            m('a.chaptercomments', {href: ch.link + '#comment_list'}, 'Read chapter comments online')
          )
        ])
      ])
    ))

    callback(chapterPage)
  })
}

// some eReaders doesn't understand linear=no, so push those items to the end of the spine/book.
function sortSpineItems (items) {
  let count = items.length
  for (let i = 0; i < count; i++) {
    let item = items[i]
    if (item.attrs.linear === 'no') {
      // push it to the end
      items.splice(i, 1)
      items.push(item)
      count--
      i--
    }
  }
  return items
}

export function createOpf (ffc) {
  let remotes = []
  ffc.remoteResources.forEach((r, url) => {
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
        m('dc:identifier#BookId', ffc.storyInfo.uuid),
        m('dc:title', ffc.storyInfo.title),
        m('dc:creator#cre', ffc.storyInfo.author.name),
        m('meta', {refines: '#cre', property: 'role', scheme: 'marc:relators'}, 'aut'),
        m('dc:date', new Date((ffc.storyInfo.publishDate || ffc.storyInfo.date_modified) * 1000).toISOString().substring(0, 10)),
        m('dc:publisher', 'Fimfiction'),
        m('dc:description', ffc.storyInfo.description),
        m('dc:source', ffc.storyInfo.url),
        m('dc:language', 'en'),
        m('meta', {name: 'cover', content: 'cover'}),
        m('meta', {property: 'dcterms:modified'}, new Date(ffc.storyInfo.date_modified * 1000).toISOString().replace('.000', '')),
        m('dc:subject', 'Fimfiction')
      ].concat(ffc.categories.map((tag) =>
        m('dc:subject', tag.name)
      ), m('meta', {name: 'fimfic2epub version', content: FIMFIC2EPUB_VERSION}))),

      m('manifest', [
        m('item', {id: 'ncx', href: 'toc.ncx', 'media-type': 'application/x-dtbncx+xml'}),
        m('item', {id: 'nav', 'href': 'Text/nav.xhtml', 'media-type': 'application/xhtml+xml', properties: 'nav'}),
        m('item', {id: 'style', href: 'Styles/style.css', 'media-type': 'text/css'}),
        m('item', {id: 'coverstyle', href: 'Styles/coverstyle.css', 'media-type': 'text/css'}),
        ffc.includeTitlePage ? m('item', {id: 'titlestyle', href: 'Styles/titlestyle.css', 'media-type': 'text/css'}) : null,

        m('item', {id: 'coverpage', href: 'Text/cover.xhtml', 'media-type': 'application/xhtml+xml', properties: ffc.hasCoverImage ? 'svg' : undefined}),
        ffc.includeTitlePage ? m('item', {id: 'titlepage', href: 'Text/title.xhtml', 'media-type': 'application/xhtml+xml'}) : null

      ].concat(ffc.storyInfo.chapters.map((ch, num) =>
        m('item', {id: 'chapter_' + zeroFill(3, num + 1), href: 'Text/chapter_' + zeroFill(3, num + 1) + '.xhtml', 'media-type': 'application/xhtml+xml'})
      ), remotes)),

      m('spine', {toc: 'ncx'}, sortSpineItems([
        m('itemref', {idref: 'coverpage'}),
        ffc.includeTitlePage ? m('itemref', {idref: 'titlepage'}) : null,
        m('itemref', {idref: 'nav', linear: ffc.storyInfo.chapters.length <= 1 ? 'no' : undefined})
      ].concat(ffc.storyInfo.chapters.map((ch, num) =>
        m('itemref', {idref: 'chapter_' + zeroFill(3, num + 1)})
      )))),

      m('guide', [
        m('reference', {type: 'cover', title: 'Cover', href: 'Text/cover.xhtml'}),
        m('reference', {type: 'toc', title: 'Contents', href: 'Text/nav.xhtml'})
      ])
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

export function createNcx (ffc) {
  let tocNcx = '<?xml version="1.0" encoding="utf-8" ?>\n' + pretty.xml(render(
    m('ncx', {version: '2005-1', xmlns: NS.DAISY}, [
      m('head', [
        m('meta', {content: ffc.storyInfo.uuid, name: 'dtb:uid'}),
        m('meta', {content: 0, name: 'dtb:depth'}),
        m('meta', {content: 0, name: 'dtb:totalPageCount'}),
        m('meta', {content: 0, name: 'dtb:maxPageNumber'})
      ]),
      m('docTitle', m('text', ffc.storyInfo.title)),
      m('navMap', navPoints([
        ['Cover', 'Text/cover.xhtml']
      ].concat(ffc.storyInfo.chapters.map((ch, num) =>
        [ch.title, 'Text/chapter_' + zeroFill(3, num + 1) + '.xhtml']
      ))))
    ])
  ))
  // console.log(tocNcx)
  return tocNcx
}

export function createNav (ffc) {
  let navDocument = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + pretty.xml(render(
    m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
      m('head', [
        m('meta', {charset: 'utf-8'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: '../Styles/style.css'}),
        m('title', 'Contents')
      ]),
      m('body#navpage', [
        m('nav#toc', {'epub:type': 'toc'}, [
          m('h3', 'Contents'),
          m('ol', [
            m('li', {hidden: ''}, m('a', {href: 'cover.xhtml'}, 'Cover'))
          ].concat(ffc.storyInfo.chapters.map((ch, num) =>
            m('li', [
              m('a.leftalign', {href: 'chapter_' + zeroFill(3, num + 1) + '.xhtml'}, ch.title)
              // m('span.date', [m('b', ' · '), prettyDate(new Date(ch.date_modified * 1000)), m('span', {style: 'display: none'}, ' · ')]),
              // m('.floatbox', m('span.wordcount', ch.realWordCount.toLocaleString('en-GB')))
            ])
          )))
        ])
      ])
    ])
  ))
  // console.log(navDocument)
  return navDocument
}

export function createCoverPage (coverFilename, w, h) {
  let body

  if (typeof coverFilename === 'string') {
    body = m('svg#cover', {xmlns: NS.SVG, 'xmlns:xlink': NS.XLINK, version: '1.1', viewBox: '0 0 ' + w + ' ' + h},
      m('image', {width: w, height: h, 'xlink:href': coverFilename})
    )
  } else {
    let ffc = coverFilename
    body = [
      m('h1', ffc.storyInfo.title),
      m('h2', ffc.storyInfo.author.name)
    ]
  }

  let coverPage = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + pretty.xml(render(
    m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
      m('head', [
        typeof coverFilename === 'string' ? m('meta', {name: 'viewport', content: 'width=' + w + ', height=' + h}) : null,
        m('title', 'Cover'),
        m('link', {rel: 'stylesheet', type: 'text/css', href: '../Styles/coverstyle.css'})
      ]),
      m('body', {'epub:type': 'cover'}, body)
    ])
  ))
  // console.log(coverPage)
  return coverPage
}

function infoBox (heading, data) {
  return m('.infobox', m('.wrap', [
    m('span.heading', heading),
    m('br'),
    m('span.data', data)
  ]))
}

function calcWordCount (chapters) {
  let count = 0
  for (let i = 0; i < chapters.length; i++) {
    let ch = chapters[i]
    count += ch.realWordCount
  }
  return count
}

export function createTitlePage (ffc) {
  let titlePage = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + pretty.xml(render(
    m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
      m('head', [
        m('meta', {charset: 'utf-8'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: '../Styles/style.css'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: '../Styles/titlestyle.css'}),
        m('title', ffc.storyInfo.title)
      ]),
      m('body#titlepage', [
        m('.title', [
          m('.story_name', ffc.storyInfo.title + ' '),
          m('.author', ['by ', m('b', ffc.storyInfo.author.name)])
        ]),
        m('.readlink', m('a', {href: ffc.storyInfo.url}, 'Read on Fimfiction')),
        // m('hr'),
        m('.categories', [
          m('div', {className: 'content-rating-' + ffc.storyInfo.content_rating_text.toLowerCase()}, ffc.storyInfo.content_rating_text.charAt(0).toUpperCase()),
          ffc.categories.map((tag) =>
            m('div', {className: tag.className}, tag.name)
          )
        ]),
        // m('hr'),
        ffc.storyInfo.prequel ? [m('div', [
          'This story is a sequel to ',
          m('a', {href: ffc.storyInfo.prequel.url}, ffc.storyInfo.prequel.title)
        ]), m('hr')] : null,
        m('#description', m.trust(ffc.storyInfo.description)),
        m('.bottom', [
          m('span', {className: 'completed-status-' + ffc.storyInfo.status.toLowerCase()}, ffc.storyInfo.status),
          ffc.storyInfo.publishDate && infoBox('First Published', prettyDate(new Date(ffc.storyInfo.publishDate * 1000))),
          infoBox('Last Modified', prettyDate(new Date(ffc.storyInfo.date_modified * 1000))),
          infoBox('Word Count', calcWordCount(ffc.storyInfo.chapters).toLocaleString('en-GB'))
        ]),
        // m('hr'),
        m('.characters', [
          ffc.tags.map((t) =>
            m('span', {className: 'character_icon', title: t.name}, m('img', {src: t.image, className: 'character_icon'}))
          )
        ])
      ])
    ])
  ))
  // console.log(titlePage)
  return titlePage
}
