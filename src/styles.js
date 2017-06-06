
let styleCss, coverstyleCss, titlestyleCss

styleCss = require('./style/style')
coverstyleCss = require('./style/coverstyle')
titlestyleCss = require('./style/titlestyle')
let paragraphsCss = {
  spaced: require('./style/paragraphs-spaced'),
  indented: require('./style/paragraphs-indented'),
  indentedall: require('./style/paragraphs-indentedall')
}

paragraphsCss.both = paragraphsCss.indented + '\n' + paragraphsCss.spaced

export { styleCss, coverstyleCss, titlestyleCss, paragraphsCss }
