
import htmlToTextModule from 'html-to-text'
import urlRegex from 'url-regex'
import matchWords from 'match-words'
import syllable from 'syllable'

export function replaceAsync (str, re, callback) {
  // http://es5.github.io/#x15.5.4.11
  str = String(str)
  let parts = []
  let i = 0
  if (Object.prototype.toString.call(re) === '[object RegExp]') {
    if (re.global) { re.lastIndex = i }
    let m
    while ((m = re.exec(str))) {
      let args = m.concat([m.index, m.input])
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

    let frame = WebPRiffParser(data, 0).frames[0]
    let width = [0]
    let height = [0]
    let decodedData = webpdecoder.WebPDecodeRGBA(
      data,
      frame['src_off'], frame['src_size'],
      width, height
    )

    let png = new PNGPacker({})
    let buffers = []
    png.on('data', (chunk) => {
      buffers.push(chunk)
    })
    png.once('end', () => {
      let pngData = Buffer.concat(buffers)
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
  text = text.replace(urlRegex(), '') // Remove urls

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

  if (!/[a-z]/i.test(text)) {
    return null
  }

  await sleep(0)

  // sentence tokenizer by Darkentor
  const tokenSentences = text
    .replace('\0', '')
    .replace(/\s+/g, ' ') // Replace all whitespace (including newlines) with a single space
    .replace(/(mr|mrs|dr|ms|prof|rev|col|cmdr|flt|lt|brgdr|hon|wng|capt|rt|revd|gen|cdre|admrl|herr|hr|frau|alderman|alhaji|brig|cdr|cik|consul|datin|dato|datuk|seri|dhr|dipl|ing|dott|sa|dra|drs|en|encik|eng|eur|exma|sra|exmo|sr|lieut|fr|fraulein|fru|graaf|gravin|grp|hajah|haji|hajim|hra|ir|lcda|lic|maj|mlle|mme|mstr|nti|sri|rva|sig|na|ra|sqn|ldr|srta|wg)\./gi, '$1')
    .replace(/(((^|\w).*?[^\w\s,]+)(?=\s+\W*[A-Z])|:|;)/g, '$1\0')
    .split(/\s*\0\s*/)

  if (typeof progresscb === 'function') {
    progresscb(0)
  }

  await sleep(0)

  const counts = { syllables: 0, words: 0 }
  let lastTime = Date.now()

  for (let i = 0; i < tokenSentences.length; i++) {
    let now = Date.now()
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
