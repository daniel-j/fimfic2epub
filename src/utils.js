
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
