
import et from 'elementtree'

// Todo: Fix missing tails outside of <body></body>

export default function kepubify (html) {
  const tree = et.parse(html)
  const body = tree.find('./body')
  addDivs(body)
  const state = {paragraph: 0, segment: 0}
  body.getchildren().forEach((child) => {
    fixupTree(child, body)
    addSpansToNode(child, body, state)
  })
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

function textToSentences (text) {
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
    // const span = createSpan(state.paragraph, state.segment++)
    // span.text = sentence
    return sentence
  })
}

// Makes text nodes of .text and .tail as children
function fixupTree (node, parent) {
  if (node.tag !== '#') {
    if (node.text && !node.tag.match(specialTags)) {
      let el = et.Element('#')
      el.text = node.text
      node._children.unshift(el)
      delete node.text
    }
    if (node.tail) {
      let el = et.Element('#')
      el.text = node.tail
      let pos = parent._children.indexOf(node) + 1
      parent._children.splice(pos, 0, el)
      delete node.tail
    }
  }
  node._children.slice(0).forEach((child) => {
    fixupTree(child, node)
  })
}

function addSpansToNode (node, parent, state) {
  // text node
  if (node.tag === '#') {
    state.segment++

    let sentences = textToSentences(node.text)
    let pos

    sentences.forEach((sentence) => {
      let span = createSpan(state.paragraph, state.segment++)
      span.text = sentence

      // insert the span before the text node
      pos = parent._children.indexOf(node)
      parent._children.splice(pos, 0, span)
    })

    // remove the text node
    pos = parent._children.indexOf(node)
    parent._children.splice(pos, 1)
  }

  if (node.tag.match(paragraphTags)) {
    state.segment = 0
    state.paragraph++
  }

  node.getchildren().slice(0).forEach((child) => {
    addSpansToNode(child, node, state)
  })
}
