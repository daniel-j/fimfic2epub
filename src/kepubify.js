
import et from 'elementtree'

// Todo: Fix missing tails outside of <body></body>

export default function kepubify (html) {
  const tree = et.parse(html)
  const body = tree.find('./body')
  addDivs(body)
  const state = {paragraph: 0, segment: 0}
  body.getchildren().forEach((child) => addSpansToNode(child, body, state))
  return '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' + tree.write({
    xml_declaration: false
  })
}

const specialTags = /^(img|pre|svg)$/i
const paragraphTags = /^(p|ol|ul)$/i

function addDivs (body) {
  const bookInner = et.Element('div', {class: 'book-inner'})
  const bookColumns = et.SubElement(bookInner, 'div', {class: 'book-columns'})

  bookColumns._children = body.getchildren()
  body._children = [bookInner]
}

function createSpan (paragraph, segment) {
  const span = et.Element('span', {
    class: 'koboSpan',
    id: 'kobo.' + paragraph + '.' + segment
  })
  return span
}

function textToSpans (node, text, state) {
  const tokenSentences = text
    .replace('\0', '')
    .replace(/\s+/g, ' ') // Replace all whitespace (including newlines) with a single space
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics since JS's \w group and explicit [a-z]|[A-Z] don't account for them
    .replace(/(mr|mrs|dr|ms|prof|rev|col|cmdr|flt|lt|brgdr|hon|wng|capt|rt|revd|gen|cdre|admrl|herr|hr|frau|alderman|alhaji|brig|cdr|cik|consul|datin|dato|datuk|seri|dhr|dipl|ing|dott|sa|dra|drs|en|encik|eng|eur|exma|sra|exmo|sr|lieut|fr|fraulein|fru|graaf|gravin|grp|hajah|haji|hajim|hra|ir|lcda|lic|maj|mlle|mme|mstr|nti|sri|rva|sig|na|ra|sqn|ldr|srta|wg|co|esq|inc|iou|ltd|mdlle|messers|messrs|mlles|mm|mmes|mt|p\.s|pvt|st|viz)\./gi, '$1')
    .replace(/(((^|\w).*?[^\w\s,]+)(?=\s+\W*[A-Z])|:|;)/g, '$1\0')
    .split(/\s*\0/)

  for (let i = 0; i < tokenSentences.length; i++) {
    let s = tokenSentences[i]
    if (s.trim().length === 0) {
      if (i - 1 >= 0) tokenSentences[i - 1] += s
      tokenSentences.splice(i, 1)
      i--
    }
  }

  return tokenSentences.map((sentence, i) => {
    const span = createSpan(state.paragraph, state.segment++)
    span.text = sentence
    return span
  })
}

function addSpansToNode (node, parent, state) {
  let nodePosition = parent.getchildren().indexOf(node)

  if (node.tag.match(paragraphTags)) {
    state.paragraph++
    state.segment = 0
  }

  if (node.tag.match(specialTags)) {
    const span = createSpan(state.paragraph, state.segment++)
    span.append(node)
    parent.getchildren().splice(nodePosition, 1, span)
  } else {
    let prependNodes = []

    if (node.text) {
      prependNodes = textToSpans(node, node.text, state)
      node.text = null
    }

    node.getchildren().forEach((child) => {
      addSpansToNode(child, node, state)
    })

    prependNodes.forEach((span, i) => {
      node.getchildren().splice(i, 0, span)
    })
  }
  if (node.tail) {
    nodePosition = parent.getchildren().indexOf(node)
    textToSpans(node, node.tail, state).forEach((span, i) => {
      parent.getchildren().splice(nodePosition + 1 + i, 0, span)
    })
    node.tail = null
  }
}
