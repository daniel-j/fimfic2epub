
import htmlToTextModule from 'html-to-text'
import urlRegexSafe from 'url-regex-safe'
import matchWords from 'match-words'
import syllable from 'syllable'
import typogr from 'typogr'
import { unicode } from './constants'

export function replaceAsync (str, re, callback) {
  // http://es5.github.io/#x15.5.4.11
  str = String(str)
  const parts = []
  let i = 0
  if (Object.prototype.toString.call(re) === '[object RegExp]') {
    if (re.global) { re.lastIndex = i }
    let m
    while ((m = re.exec(str))) {
      const args = m.concat([m.index, m.input])
      parts.push(str.slice(i, m.index), callback.apply(null, args))
      i = re.lastIndex
      if (!re.global) { break } // for non-global regexes only take the first match
      if (m[0].length === 0) { re.lastIndex++ }
    }
  } else {
    re = String(re)
    i = str.indexOf(re)
    parts.push(str.slice(0, i), callback(re, i, str))
    i += re.length
  }
  parts.push(str.slice(i))
  return Promise.all(parts).then(function (strings) {
    return strings.join('')
  })
}

let webpdecoder = null

export function webp2png (data) {
  return new Promise((resolve, reject) => {
    const libwebp = require('./vendor/libwebp')
    const WebPRiffParser = require('./vendor/libwebp-demux').WebPRiffParser
    const PNGPacker = require('node-png/lib/packer')

    if (!webpdecoder) {
      webpdecoder = new libwebp.WebPDecoder()
    }

    const frame = WebPRiffParser(data, 0).frames[0]
    const width = [0]
    const height = [0]
    const decodedData = webpdecoder.WebPDecodeRGBA(
      data,
      frame.src_off, frame.src_size,
      width, height
    )

    const png = new PNGPacker({})
    const buffers = []
    png.on('data', (chunk) => {
      buffers.push(chunk)
    })
    png.once('end', () => {
      const pngData = Buffer.concat(buffers)
      resolve(pngData)
    })
    png.pack(decodedData, width[0], height[0])
  })
}

export function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function htmlToText (html, options = {}) {
  options = Object.assign({
    wordwrap: false,
    ignoreImage: true,
    ignoreHref: true
  }, options)
  return htmlToTextModule.fromString(html, options)
}

export function htmlWordCount (html) {
  html = html.replace(/<pre>.*?<\/pre>/g, '') // Ignore codeblocks
  let text = htmlToText(html)
  text = text.replace(urlRegexSafe(), '') // Remove urls

  let count = 0
  try {
    count = matchWords(text).length
  } catch (err) { count = 0 }
  return count
}

export async function readingEase (text, wakeupInterval = Infinity, progresscb) {
  const result = {
    sentences: 0, words: 0, syllables: 0, grade: NaN, ease: NaN
  }

  // sentence tokenizer by Darkentor
  const tokenSentences = text
    .replace('\0', '')
    .replace(/\s+/g, ' ') // Replace all whitespace (including newlines) with a single space
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics since JS's \w group and explicit [a-z]|[A-Z] don't account for them
    .replace(/(mr|mrs|dr|ms|prof|rev|col|cmdr|flt|lt|brgdr|hon|wng|capt|rt|revd|gen|cdre|admrl|herr|hr|frau|alderman|alhaji|brig|cdr|cik|consul|datin|dato|datuk|seri|dhr|dipl|ing|dott|sa|dra|drs|en|encik|eng|eur|exma|sra|exmo|sr|lieut|fr|fraulein|fru|graaf|gravin|grp|hajah|haji|hajim|hra|ir|lcda|lic|maj|mlle|mme|mstr|nti|sri|rva|sig|na|ra|sqn|ldr|srta|wg|co|esq|inc|iou|ltd|mdlle|messers|messrs|mlles|mm|mmes|mt|p\.s|pvt|st|viz)\./gi, '$1')
    .replace(/(((^|\w).*?[^\w\s,]+)(?=\s+\W*[A-Z])|:|;)/g, '$1\0')
    .split(/\s*\0\s*/)

  if (!/[a-z]/i.test(text)) {
    return null
  }

  await sleep(0)

  if (typeof progresscb === 'function') {
    progresscb(0)
  }

  await sleep(0)

  const counts = { syllables: 0, words: 0 }
  let lastTime = Date.now()

  for (let i = 0; i < tokenSentences.length; i++) {
    const now = Date.now()
    if (lastTime + wakeupInterval < now) {
      lastTime = now
      if (typeof progresscb === 'function') {
        progresscb(i / tokenSentences.length)
      }
      await sleep(0)
    }
    const sentence = tokenSentences[i]
    // strip all punctuation and numbers from the sentence
    const words = sentence
      .replace(/[^\w\s]|_/g, '')
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(letter => letter)

    counts.syllables += words.reduce((total, word) => total + syllable(word), 0)
    counts.words += words.length
  }

  const { words, syllables } = counts
  const sentences = tokenSentences.length
  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
  const ease = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)

  tokenSentences.length = 0

  if (!ease) {
    return null
  }

  Object.assign(result, {
    sentences, words, syllables, grade, ease
  })

  if (typeof progresscb === 'function') {
    progresscb(1)
  }

  return result
}

export function typogrify (content) {
  content = typogr(content.replace(/&quot;/ig, '"').replace(/\.\.\.+/ig, '...')).chain().smartypants().ord().value()
  content = content.replace(/&nbsp;/ig, unicode.NO_BREAK_SPACE) // non-breaking space
  content = content.replace(/&#8217;/ig, '’').replace(/&#8216;/ig, '‘') // curly single quotation marks
  content = content.replace(/&#8220;/ig, '“').replace(/&#8221;/ig, '”') // curly double quotation marks
  content = content.replace(/&#8230;/ig, '…') // ellipsis
  content = content.replace(/&#8211;/ig, '–').replace(/&#8212;/ig, '—') // en and em dash

  /*
   * Some of the following is from Standard Ebooks’ typogrify tool:
   * https://github.com/standardebooks/tools/blob/master/typogrify
   */

  content = content.replace(/[‘’]”<\/p>/ig, '’' + unicode.HAIR_SPACE + '”</p>')

  let inSkippedTag = false
  let closeMatch
  const reSkipTags = /<(\/)?(style|pre|code|kbd|script|math|title)[^>]*>/i

  content = typogr.tokenize(content).map(({ type, txt }) => {
    if (type === 'tag') {
      closeMatch = reSkipTags.exec(txt)
      if (closeMatch && closeMatch[1] === undefined) {
        inSkippedTag = true
      } else {
        inSkippedTag = false
      }
    } else if (!inSkippedTag) {
      // Remove spaces between en and em dashes
      // Note that we match at least one character before the dashes, so that we don't catch start-of-line em dashes like in poetry.
      txt = txt.replace(/([^.\s])\s*([–—])\s*/g, '$1$2')

      // First, remove stray word joiners
      txt = txt.replace(new RegExp(unicode.WORD_JOINER, 'g'), '')

      // Some older texts use the ,— construct; remove that archaichism
      txt = txt.replace(/,—/g, '—')

      // Em dashes and two-em-dashes can be broken before, so add a word joiner between letters/punctuation and the following em dash
      // txt = txt.replace(new RegExp('([^\\s' + unicode.WORD_JOINER + unicode.NO_BREAK_SPACE + unicode.HAIR_SPACE + '])([—⸻])', 'ig'), '$1' + unicode.WORD_JOINER + '$2')

      // Add en dashes between numbers
      txt = txt.replace(/([0-9]+)-([0-9]+)/g, '$1–$2')

      // Add a word joiner on both sides of en dashes
      txt = txt.replace(new RegExp(unicode.WORD_JOINER + '?–' + unicode.WORD_JOINER + '?', 'g'), unicode.WORD_JOINER + '–' + unicode.WORD_JOINER)

      // Replace Mr., Mrs., and other abbreviations, and include a non-breaking space
      txt = txt.replace(/\b(Mr|Mr?s|Drs?|Profs?|Lieut|Fr|Lt|Capt|Pvt|Esq|Mt|St|MM|Mmes?|Mlles?)\.?\s+/g, '$1.' + unicode.NO_BREAK_SPACE)
      txt = txt.replace(/\bNo\.\s+([0-9]+)/g, 'No.' + unicode.NO_BREAK_SPACE + '$1')

      // Fix common abbreviatons
      txt = txt.replace(/(\s)‘([an])’(\s)/ig, '$1’$2’$3')

      // Years
      // txt = txt.replace(/‘([0-9]{2,}[^a-zA-Z0-9’])/ig, '’$1')

      txt = txt.replace(/‘([Aa]ve|[Oo]me|[Ii]m|[Mm]idst|[Gg]ainst|[Nn]eath|[Ee]m|[Cc]os|[Tt]is|[Tt]was|[Tt]wixt|[Tt]were|[Tt]would|[Tt]wouldn|[Tt]ween|[Tt]will|[Rr]ound|[Pp]on)\b/g, '’$1')

      // txt = txt.replace(/\b‘e\b/g, '’e')
      // txt = txt.replace(/\b‘([Ee])r\b/g, '’$1r')
      txt = txt.replace(/\b‘([Ee])re\b/g, '’$1re')
      // txt = txt.replace(/\b‘([Aa])ppen\b/g, '’$1ppen')
      txt = txt.replace(/\b‘([Aa])ven\b/g, '’$1ven') // 'aven't

      // nth (as in nth degree)
      txt = txt.replace(/\bn-?th\b/g, '<i>n</i>th')

      // Remove double spaces that use NO_BREAK_SPACE for spacing
      txt = txt.replace(new RegExp(unicode.NO_BREAK_SPACE + '[' + unicode.NO_BREAK_SPACE + ' ]+', 'g'), ' ')
      txt = txt.replace(new RegExp(' [' + unicode.NO_BREAK_SPACE + ' ]+', 'g'), ' ')

      // Put spacing next to close quotes
      txt = txt.replace(new RegExp('“[\\s' + unicode.NO_BREAK_SPACE + ']*‘', 'ig'), '“' + unicode.HAIR_SPACE + '‘')
      txt = txt.replace(new RegExp('’[\\s' + unicode.NO_BREAK_SPACE + ']*”', 'ig'), '’' + unicode.HAIR_SPACE + '”')
      txt = txt.replace(new RegExp('“[\\s' + unicode.NO_BREAK_SPACE + ']*’', 'ig'), '“' + unicode.HAIR_SPACE + '’')
      txt = txt.replace(new RegExp('‘[\\s' + unicode.NO_BREAK_SPACE + ']*“', 'ig'), '‘' + unicode.HAIR_SPACE + '“')

      // We require a non-letter char at the end, otherwise we might match a contraction: “Hello,” ’e said.
      txt = txt.replace(new RegExp('”[\\s' + unicode.NO_BREAK_SPACE + ']*’([^a-zA-Z])', 'ig'), '”' + unicode.HAIR_SPACE + '’$1')

      // Fix ellipses spacing
      txt = txt.replace(/\s*\.\s*\.\s*\.\s*/ig, '…')
      txt = txt.replace(new RegExp('[\\s' + unicode.NO_BREAK_SPACE + ']?…[\\s' + unicode.NO_BREAK_SPACE + ']?\\.', 'ig'), '.' + unicode.HAIR_SPACE + '…')
      txt = txt.replace(new RegExp('[\\s' + unicode.NO_BREAK_SPACE + ']?…[\\s' + unicode.NO_BREAK_SPACE + ']?', 'ig'), unicode.HAIR_SPACE + '… ')

      // Add non-breaking spaces between amounts with an abbreviated unit.  E.g. 8 oz., 10 lbs.
      txt = txt.replace(/([0-9])\s+([a-z]{1,3}\.)/ig, '$1' + unicode.NO_BREAK_SPACE + '$2')

      // Add non-breaking spaces between Arabic numbers and AM/PM
      txt = txt.replace(/([0-9])\s+([ap])\.?m\./ig, '$1' + unicode.NO_BREAK_SPACE + '$2.m.')

      // Fractions
      txt = txt.replace(/1\/4/g, '¼')
      txt = txt.replace(/1\/2/g, '½')
      txt = txt.replace(/3\/4/g, '¾')
      txt = txt.replace(/1\/3/g, '⅓')
      txt = txt.replace(/2\/3/g, '⅔')
      txt = txt.replace(/1\/5/g, '⅕')
      txt = txt.replace(/2\/5/g, '⅖')
      txt = txt.replace(/3\/5/g, '⅗')
      txt = txt.replace(/4\/5/g, '⅘')
      txt = txt.replace(/1\/6/g, '⅙')
      txt = txt.replace(/5\/6/g, '⅚')
      txt = txt.replace(/1\/8/g, '⅛')
      txt = txt.replace(/3\/8/g, '⅜')
      txt = txt.replace(/5\/8/g, '⅝')
      txt = txt.replace(/7\/8/g, '⅞')

      // Remove spaces between whole numbers and fractions
      txt = txt.replace(/([0-9,]+)\s+([¼½¾⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1$2')

      // Use the Unicode Minus glyph (U+2212) for negative numbers
      txt = txt.replace(/([\s])-([0-9,]+)/g, '$1−$2')

      txt = txt.replace(new RegExp(unicode.NO_BREAK_SPACE, 'ig'), '&#160;') // non-breaking space entity
    }
    return txt
  }).join('')

  // content = content.replace(new RegExp('<p([^>]*?)>' + unicode.HAIR_SPACE + '…', 'ig'), '<p$1>…')

  // Remove spaces between opening tags and ellipses
  // content = content.replace(new RegExp('(<[a-z0-9]+[^<]+?>)[\\s' + unicode.NO_BREAK_SPACE + ']+?…', 'ig'), '$1…')

  // Remove spaces between closing tags and ellipses
  // content = content.replace(new RegExp('…[\\s' + unicode.NO_BREAK_SPACE + ']?(</[a-z0-9]+>)', 'ig'), '…$1')
  // content = content.replace(new RegExp('…[\\s' + unicode.NO_BREAK_SPACE + ']+([\\)”’])', 'ig'), '…$1')
  // content = content.replace(new RegExp('([\\(“‘])[\\s' + unicode.NO_BREAK_SPACE + ']+…', 'ig'), '$1…')
  // content = content.replace(new RegExp('…[\\s' + unicode.NO_BREAK_SPACE + ']?([\\!\\?\\.\\;\\,])', 'ig'), '…' + unicode.HAIR_SPACE + '$1')
  // content = content.replace(new RegExp('([\\!\\?\\.\\;”’])[\\s' + unicode.NO_BREAK_SPACE + ']?…', 'ig'), '$1' + unicode.HAIR_SPACE + '…')
  // content = content.replace(new RegExp('\\,[\\s' + unicode.NO_BREAK_SPACE + ']?…', 'ig'), ',' + unicode.HAIR_SPACE + '…')

  content = content.replace(new RegExp(unicode.NO_BREAK_SPACE, 'g'), '&#160;')
  content = content.replace(new RegExp(unicode.HAIR_SPACE, 'g'), '&#8202;')
  content = content.replace(new RegExp(unicode.WORD_JOINER, 'g'), '&#8288;')

  return content
}
