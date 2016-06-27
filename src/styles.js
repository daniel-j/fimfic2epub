
import isNode from 'detect-node'

let styleCss, coverstyleCss, titlestyleCss

if (!isNode) {
  styleCss = require('./style')
  coverstyleCss = require('./coverstyle')
  titlestyleCss = require('./titlestyle')
} else {
  process.stylus.render(process.fs.readFileSync(process.path.join(__dirname, './style.styl'), 'utf8'), (err, css) => {
    if (err) throw err
    styleCss = css
  })
  process.stylus.render(process.fs.readFileSync(process.path.join(__dirname, './coverstyle.styl'), 'utf8'), (err, css) => {
    if (err) throw err
    coverstyleCss = css
  })
  process.stylus.render(process.fs.readFileSync(process.path.join(__dirname, './titlestyle.styl'), 'utf8'), (err, css) => {
    if (err) throw err
    titlestyleCss = css
  })
}

export { styleCss, coverstyleCss, titlestyleCss }
