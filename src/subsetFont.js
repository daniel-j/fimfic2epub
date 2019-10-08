
import isNode from 'detect-node'
import { Font } from 'fonteditor-core'
import fs from 'fs'
import fetch from './fetch'
import fileType from 'file-type'

async function subsetFont (fontPath, glyphs, options = {}) {
  let data
  const fontdata = Buffer.from(fontPath, 'binary')
  const type = fileType(fontdata)
  if (type && type.mime === 'font/ttf') {
    data = fontdata.buffer
  } else {
    if (!isNode || !options.local) {
      data = await fetch(fontPath, 'arraybuffer')
    } else {
      data = await new Promise((resolve, reject) => {
        fs.readFile(fontPath, (err, data) => {
          if (err) reject(err)
          else resolve(data)
        })
      })
    }
  }
  return Font.create(data, {
    type: 'ttf',
    subset: glyphs,
    hinting: true
  }).write({
    type: 'ttf',
    hinting: true
  })
}

export default subsetFont
