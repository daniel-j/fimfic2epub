
import et from 'elementtree'

export default function kepubify (html) {
  const tree = et.parse(html)
  const body = tree.find('./body')
  addDivs(body)
  body.getchildren().forEach((child) => addSpansToNode(child, body))
  return tree.write()
}

const specialTags = /^(img|pre)$/i
const sentenceRe = /(((^|\w).*?[^\w\s,]+)(?=\s+\W*[A-Z])|:|;)/g
let paragraph_counter = 0
let segment_counter = 0

function addDivs (body) {
  const bookInner = et.Element('div', {class: 'book-inner'})
  const bookColumns = et.SubElement(bookInner, 'div', {class: 'book-columns'})

  body.getchildren().forEach((child, i) => {
    body.getchildren().splice(i, 1)
    bookColumns.getchildren().push(child)
  })
  body.append(bookInner)
}

function createSpan (paragraph, segment) {
  const span = et.Element('span', {
    class: 'koboSpan',
    id: 'kobo.' + paragraph + '.' + segment
  })
  return span
}

function addSpans (node, text) {
  const tokenSentences = text
    .replace('\0', '')
    .replace(/\s+/g, ' ') // Replace all whitespace (including newlines) with a single space
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics since JS's \w group and explicit [a-z]|[A-Z] don't account for them
    .replace(/(mr|mrs|dr|ms|prof|rev|col|cmdr|flt|lt|brgdr|hon|wng|capt|rt|revd|gen|cdre|admrl|herr|hr|frau|alderman|alhaji|brig|cdr|cik|consul|datin|dato|datuk|seri|dhr|dipl|ing|dott|sa|dra|drs|en|encik|eng|eur|exma|sra|exmo|sr|lieut|fr|fraulein|fru|graaf|gravin|grp|hajah|haji|hajim|hra|ir|lcda|lic|maj|mlle|mme|mstr|nti|sri|rva|sig|na|ra|sqn|ldr|srta|wg|co|esq|inc|iou|ltd|mdlle|messers|messrs|mlles|mm|mmes|mt|p\.s|pvt|st|viz)\./gi, '$1')
    .replace(/(((^|\w).*?[^\w\s,]+)(?=\s+\W*[A-Z])|:|;)/g, '$1\0')
    .split(/\s*\0\s*/)

  return tokenSentences.map((sentence, i) => {
    if (!sentence) return null
    const span = createSpan(paragraph_counter, segment_counter)
    span.text = sentence
    return span
  }).filter((el) => el)
}

function addSpansToNode (node, parent) {
  const nodePosition = parent.getchildren().indexOf(node)

  if (node.tag.match(specialTags)) {
    const span = createSpan(paragraph_counter, segment_counter)
    span.append(node)
    parent.getchildren().splice(nodePosition, 1, span)
  } else {
    node.getchildren().forEach((child) => {
      addSpansToNode(child, node)
    })
  }

  if (node.text) {
    addSpans(node, node.text).forEach((span, i) => {
      node.getchildren().splice(i, 0, span)
    })
    node.text = null
  }
  if (node.tail) {
    addSpans(node, node.tail).forEach((span, i) => {
      parent.getchildren().splice(nodePosition + 1 + i, 0, span)
    })
    node.tail = null
  }
}
