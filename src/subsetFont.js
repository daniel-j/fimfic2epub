
import isNode from 'detect-node'
import { Font } from 'fonteditor-core'
import fs from 'fs'
import fetch from './fetch'

async function subsetFont (fontPath, glyphs, options = {}) {
  let data
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
