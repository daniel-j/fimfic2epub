const cheerio = require('cheerio')
const fs = require('fs')

let content = fs.readFileSync('test.xhtml', 'utf8')

let $ = cheerio.load(content, {xmlMode: true})

let elements = $('p, h1, h2, h3, h4, h5, h6')

elements.each((i, element) => {
  let el = $(element)
  let newTag = $('<span/>')
  newTag.attr('id', 'kobo.' + i + '.1')
  newTag.append(el.contents())
  el.append(newTag)
})

console.log($.xml())
