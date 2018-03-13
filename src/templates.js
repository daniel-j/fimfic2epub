
import m from 'mithril'
import render from 'mithril-node-render'
import { pd as pretty } from 'pretty-data'
import zeroFill from 'zero-fill'

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

export function createChapter (ch) {
  let {content, notes, notesFirst, title, link, linkNotes} = ch

  let sections = [
    m.trust(content || ''),
    notes ? m('div#author_notes', {className: notesFirst ? 'top' : 'bottom'}, [
      m('p', m('b', 'Author\'s Note:')),
      m.trust(notes)]) : null
  ]

  // if author notes are a the beginning of the chapter
  if (notes && notesFirst) {
    sections.reverse()
  }

  const tokenContent = '%%HTML_CONTENT_' + Math.random() + '%%'

  return Promise.all([
    render(
      m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
        m('head', [
          m('meta', {charset: 'utf-8'}),
          m('link', {rel: 'stylesheet', type: 'text/css', href: '../Styles/style.css'}),
          m('title', title)
        ]),
        m('body', {'epub:type': 'bodymatter chapter'}, m('section', [
          title ? m('.chapter-title', [
            m('h1', title),
            m('hr.old')
          ]) : null,
          tokenContent,
          (link || linkNotes) ? m('p.double', {style: 'text-align: center; clear: both;'},
            link ? m('a.chaptercomments', {href: link + '#comment_list'}, 'Read chapter comments online') : null,
            linkNotes ? m('a.chaptercomments', {href: linkNotes}, 'Read author\'s note') : null
          ) : null
        ]))
      ])
      , {strict: true}),
    render(sections)
  ]).then(([chapterPage, sectionsData]) => {
    chapterPage = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + chapterPage
    chapterPage = chapterPage.replace(tokenContent, '\n' + sectionsData + '\n')
    return chapterPage
  })
}

// some eReaders doesn't understand linear=no, so push those items to the end of the spine/book.
function sortSpineItems (items) {
  let count = items.length
  for (let i = 0; i < count; i++) {
    let item = items[i]
    if (!item) {
      continue
    }
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
  // let remoteCounter = 0
  ffc.remoteResources.forEach((r, url) => {
    // remoteCounter++
    if (!ffc.options.includeExternal) {
      // hack-ish, but what can I do?
      // turns out only video and audio can be remote resources.. :I
      /*
      if (url.indexOf('//') === 0) {
        url = 'http:' + url
      }
      if (url.indexOf('/') === 0) {
        url = 'http://www.fimfiction.net' + url
      }
      let mime = null
      if (url.toLowerCase().lastIndexOf('.png')) {
        mime = 'image/png'
      } else if (url.toLowerCase().lastIndexOf('.jpg')) {
        mime = 'image/jpeg'
      }
      if (mime) {
        remotes.push(m('item', {id: 'remote_' + zeroFill(3, remoteCounter), href: url, 'media-type': mime}))
      }
      */
      return
    }
    if (!r.dest) {
      return
    }
    remotes.push(m('item', {id: r.filename, href: r.dest, 'media-type': r.type}))
  })

  let manifestChapters = ffc.storyInfo.chapters.map((ch, num) =>
    m('item', {id: 'chapter_' + zeroFill(3, num + 1), href: 'Text/chapter_' + zeroFill(3, num + 1) + '.xhtml', 'media-type': 'application/xhtml+xml', properties: ch.remote ? 'remote-resources' : null})
  )
  let spineChapters = ffc.storyInfo.chapters.map((ch, num) =>
    m('itemref', {idref: 'chapter_' + zeroFill(3, num + 1)})
  )
  let manifestNotes = []
  let spineNotes = []
  if (ffc.options.includeAuthorNotes && ffc.options.useAuthorNotesIndex && ffc.hasAuthorNotes) {
    spineNotes.push(m('itemref', {idref: 'notesnav'}))
    ffc.chaptersWithNotes.forEach((num) => {
      let id = 'note_' + zeroFill(3, num + 1)
      manifestNotes.push(m('item', {id: id, href: 'Text/' + id + '.xhtml', 'media-type': 'application/xhtml+xml'}))
      spineNotes.push(m('itemref', {idref: id}))
    })
  }

  let subjects = ffc.subjects
  if (ffc.options.joinSubjects) {
    subjects = [subjects.join(', ')]
  }

  return render(
    m('package', {xmlns: NS.OPF, version: '3.0', 'unique-identifier': 'BookId'}, [
      m('metadata', {'xmlns:dc': NS.DC, 'xmlns:opf': NS.OPF}, [
        m('dc:identifier#BookId', ffc.storyInfo.uuid),
        m('dc:title', ffc.storyInfo.title),
        m('dc:creator#cre', ffc.storyInfo.author.name),
        m('meta', {refines: '#cre', property: 'role', scheme: 'marc:relators'}, 'aut'),
        m('dc:date', new Date((ffc.storyInfo.publishDate || ffc.storyInfo.date_modified) * 1000).toISOString().substring(0, 10)),
        m('dc:publisher', 'Fimfiction'),
        ffc.storyInfo.short_description ? m('dc:description', ffc.storyInfo.short_description) : null,
        m('dc:source', ffc.storyInfo.url),
        m('dc:language', 'en'),
        ffc.coverImage ? m('meta', {name: 'cover', content: 'cover'}) : null,
        m('meta', {property: 'dcterms:modified'}, new Date(ffc.storyInfo.date_modified * 1000).toISOString().replace('.000', ''))
      ].concat(subjects.map((s) =>
        m('dc:subject', s)
      ), m('meta', {name: 'fimfic2epub version', content: FIMFIC2EPUB_VERSION}))),

      m('manifest', [
        ffc.coverImage ? m('item', {id: 'cover', href: ffc.coverFilename, 'media-type': ffc.coverType, properties: 'cover-image'}) : null,
        m('item', {id: 'ncx', href: 'toc.ncx', 'media-type': 'application/x-dtbncx+xml'}),
        m('item', {id: 'nav', 'href': 'nav.xhtml', 'media-type': 'application/xhtml+xml', properties: 'nav'}),
        ffc.options.includeAuthorNotes && ffc.options.useAuthorNotesIndex && ffc.hasAuthorNotes ? m('item', {id: 'notesnav', 'href': 'notesnav.xhtml', 'media-type': 'application/xhtml+xml'}) : null,

        m('item', {id: 'style', href: 'Styles/style.css', 'media-type': 'text/css'}),
        m('item', {id: 'coverstyle', href: 'Styles/coverstyle.css', 'media-type': 'text/css'}),
        m('item', {id: 'titlestyle', href: 'Styles/titlestyle.css', 'media-type': 'text/css'}),
        m('item', {id: 'navstyle', href: 'Styles/navstyle.css', 'media-type': 'text/css'}),

        ffc.iconsFont ? m('item', {id: 'font-awesome', href: 'Fonts/fontawesome-webfont-subset.ttf', 'media-type': 'application/x-font-ttf'}) : null,

        m('item', {id: 'coverpage', href: 'Text/cover.xhtml', 'media-type': 'application/xhtml+xml', properties: ffc.coverImage ? 'svg' : undefined}),
        m('item', {id: 'titlepage', href: 'Text/title.xhtml', 'media-type': 'application/xhtml+xml', properties: ffc.hasRemoteResources.titlePage ? 'remote-resources' : null})

      ].concat(manifestChapters, manifestNotes, remotes)),

      m('spine', {toc: 'ncx'}, sortSpineItems([
        m('itemref', {idref: 'coverpage'}),
        m('itemref', {idref: 'titlepage'}),
        m('itemref', {idref: 'nav', linear: ffc.storyInfo.chapters.length <= 1 && !(ffc.options.includeAuthorNotes && ffc.options.useAuthorNotesIndex && ffc.hasAuthorNotes) ? 'no' : undefined})
      ].concat(
        spineChapters,
        spineNotes
      ))),
      m('guide', [
        m('reference', {type: 'cover', title: 'Cover', href: 'Text/cover.xhtml'}),
        m('reference', {type: 'toc', title: 'Contents', href: 'nav.xhtml'})
      ])
    ])
    , {strict: true}).then((contentOpf) => {
      contentOpf = '<?xml version="1.0" encoding="utf-8"?>\n' + pretty.xml(contentOpf)
      return contentOpf
    })
}

function navPoints (list) {
  let arr = []
  for (let i = 0; i < list.length; i++) {
    if (!list[i]) continue
    arr.push(m('navPoint', {id: 'navPoint-' + (i + 1), playOrder: i + 1}, [
      m('navLabel', m('text', list[i][0])),
      m('content', {src: list[i][1]})
    ]))
  }
  return arr
}
export function createNcx (ffc) {
  return render(
    m('ncx', {version: '2005-1', xmlns: NS.DAISY}, [
      m('head', [
        m('meta', {content: ffc.storyInfo.uuid, name: 'dtb:uid'}),
        m('meta', {content: 0, name: 'dtb:depth'}),
        m('meta', {content: 0, name: 'dtb:totalPageCount'}),
        m('meta', {content: 0, name: 'dtb:maxPageNumber'})
      ]),
      m('docTitle', m('text', ffc.storyInfo.title)),
      m('navMap', navPoints([
        ['Cover', 'Text/cover.xhtml'],
        ['Title Page', 'Text/title.xhtml'],
        ffc.storyInfo.chapters.length > 1 || (ffc.options.includeAuthorNotes && ffc.options.useAuthorNotesIndex && ffc.hasAuthorNotes) ? ['Contents', 'nav.xhtml'] : null
      ].concat(ffc.storyInfo.chapters.map((ch, num) =>
        [ch.title, 'Text/chapter_' + zeroFill(3, num + 1) + '.xhtml']
      ), ffc.options.includeAuthorNotes && ffc.options.useAuthorNotesIndex && ffc.hasAuthorNotes ? [['Author\'s Notes', 'notesnav.xhtml']] : null)))
    ])
    , {strict: true}).then((tocNcx) => {
      tocNcx = '<?xml version="1.0" encoding="utf-8" ?>\n' + pretty.xml(tocNcx)
      return tocNcx
    })
}

export function createNav (ffc) {
  let list = [
    m('li', {hidden: ''}, m('a', {href: 'Text/cover.xhtml'}, 'Cover')),
    m('li', {hidden: ''}, m('a', {href: 'Text/title.xhtml'}, 'Title Page')),
    ffc.storyInfo.chapters.length > 1 || (ffc.options.includeAuthorNotes && ffc.options.useAuthorNotesIndex && ffc.hasAuthorNotes) ? m('li', {hidden: ''}, m('a', {href: 'nav.xhtml'}, 'Contents')) : null
  ].concat(ffc.storyInfo.chapters.map((ch, num) =>
    m('li', [
      m('a.leftalign', {href: 'Text/chapter_' + zeroFill(3, num + 1) + '.xhtml'}, ch.title)
    ])
  ))
  let prettyList = ffc.storyInfo.chapters.map((ch, num) =>
    m('.item', [
      m('.floatbox', m('span.wordcount', ch.realWordCount.toLocaleString('en-GB'))),
      m('a.leftalign', {href: 'Text/chapter_' + zeroFill(3, num + 1) + '.xhtml'}, ch.title),
      m('span.date', [m('b', ' · '), prettyDate(new Date(ch.date_modified * 1000))])
    ])
  )
  if (ffc.options.includeAuthorNotes && ffc.options.useAuthorNotesIndex && ffc.hasAuthorNotes) {
    list.push(m('li', m('a', {href: 'notesnav.xhtml'}, 'Author\'s Notes')))
    prettyList.push(m('.item.double', m('a.leftalign', {href: 'notesnav.xhtml'}, 'Author\'s Notes')))
  }

  return render(
    m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
      m('head', [
        m('meta', {charset: 'utf-8'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: 'Styles/style.css'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: 'Styles/navstyle.css'}),
        m('title', 'Contents')
      ]),
      m('body', {'epub:type': 'frontmatter toc'}, m('section', [
        m('h3', 'Contents'),
        m('#toc.hidden', prettyList),
        m('nav.invisible', {'epub:type': 'toc'}, m('ol', list))
      ]))
    ])
    , {strict: true}).then((navDocument) => {
      navDocument = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + pretty.xml(navDocument)
      return navDocument
    })
}

export function createNotesNav (ffc) {
  let list = ffc.chaptersWithNotes.map((num) => {
    let ch = ffc.storyInfo.chapters[num]
    return m('.item', m('a.leftalign', {href: 'Text/note_' + zeroFill(3, num + 1) + '.xhtml'}, ch.title))
  })

  return render(
    m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
      m('head', [
        m('meta', {charset: 'utf-8'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: 'Styles/style.css'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: 'Styles/navstyle.css'}),
        m('title', 'Author\'s Notes')
      ]),
      m('body#navpage', {'epub:type': 'frontmatter toc'}, m('section', [
        m('h3', 'Author\'s Notes'),
        m('#toc', list)
      ]))
    ])
    , {strict: true}).then((navDocument) => {
      navDocument = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + pretty.xml(navDocument)
      return navDocument
    })
}

export function createCoverPage (ffc) {
  let body

  let {width, height} = ffc.coverImageDimensions

  if (ffc.coverImage) {
    body = m('svg#cover', {xmlns: NS.SVG, 'xmlns:xlink': NS.XLINK, version: '1.1', viewBox: '0 0 ' + width + ' ' + height},
      m('image', {width: width, height: height, 'xlink:href': '../' + ffc.coverFilename})
    )
  } else {
    body = [
      m('h1', ffc.storyInfo.title),
      m('h2', ffc.storyInfo.author.name)
    ]
  }

  return render(
    m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
      m('head', [
        ffc.coverImage ? m('meta', {name: 'viewport', content: 'width=' + width + ', height=' + height}) : null,
        m('title', 'Cover'),
        m('link', {rel: 'stylesheet', type: 'text/css', href: '../Styles/coverstyle.css'})
      ]),
      m('body#coverpage', {'epub:type': 'frontmatter cover'}, m('section', body))
    ])
    , {strict: true}).then((coverPage) => {
      coverPage = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + pretty.xml(coverPage)
      return coverPage
    })
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
function calcReadingEase (chapters) {
  let avg = 0
  for (let i = 0; i < chapters.length; i++) {
    let ch = chapters[i]
    avg += ch.readingEase.ease
  }
  avg = avg / chapters.length
  return Math.round(avg * 100) / 100
}

export function createTitlePage (ffc) {
  const tokenContent = '%%HTML_CONTENT_' + Math.random() + '%%'

  const completedIcon = {
    complete: 'check',
    incomplete: 'pencil',
    hiatus: 'pause',
    cancelled: 'ban'
  }

  return render(
    m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS}, [
      m('head', [
        m('meta', {charset: 'utf-8'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: '../Styles/style.css'}),
        m('link', {rel: 'stylesheet', type: 'text/css', href: '../Styles/titlestyle.css'}),
        m('title', ffc.storyInfo.title)
      ]),
      m('body#titlepage', {'epub:type': 'frontmatter titlepage'}, m('section', [
        m('header.title', [
          m('div', {className: 'content-rating content-rating-' + ffc.storyInfo.content_rating_text.toLowerCase()}, ffc.storyInfo.content_rating_text.charAt(0).toUpperCase()),
          m('.story_name', ffc.storyInfo.title + ' '),
          m('.author', ['by ', m('b', ffc.storyInfo.author.name)])
        ]),
        // m('hr'),
        m('section.tags', [
          ffc.tags.filter((tag) => tag.type !== 'character').map((tag) =>
            [m('div', {className: tag.className}, tag.name), ' ']
          )
        ]),
        m('.readlink', m('a', {href: ffc.storyInfo.url}, 'Story on Fimfiction')),
        // m('hr'),
        ffc.storyInfo.prequel ? [m('div', [
          m('br'),
          'This story is a sequel to ',
          m('a', {href: ffc.storyInfo.prequel.url}, ffc.storyInfo.prequel.title)
        ]), m('hr.old')] : null,
        m('#description', tokenContent),
        m('.bottom', [
          m('section', {className: 'completed-status completed-status-' + ffc.storyInfo.status.toLowerCase()}, [
            m('i.fa.fa-fw.fa-' + completedIcon[ffc.storyInfo.status.toLowerCase()]),
            m('span', ffc.storyInfo.status)
          ]),
          ffc.storyInfo.publishDate && infoBox('First Published', prettyDate(new Date(ffc.storyInfo.publishDate * 1000))),
          infoBox('Last Modified', prettyDate(new Date(ffc.storyInfo.date_modified * 1000))),
          infoBox('Word Count', calcWordCount(ffc.storyInfo.chapters).toLocaleString('en-GB')),
          ffc.options.calculateReadingEase ? infoBox('Reading Ease', calcReadingEase(ffc.storyInfo.chapters).toLocaleString('en-GB')) : null
        ]),
        // m('hr'),
        m('section.tags', [
          ffc.tags.filter((tag) => tag.type === 'character').map((tag) =>
            [m('div', {className: tag.className}, tag.name), ' ']
          )
        ])
      ]))
    ])
    , {strict: true}).then((titlePage) => {
      titlePage = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + titlePage
      titlePage = titlePage.replace(tokenContent, '\n' + ffc.storyInfo.description + '\n')
      return titlePage
    })
}
