
const styleCss = require('./style/style')
const coverstyleCss = require('./style/coverstyle')
const titlestyleCss = require('./style/titlestyle')
const navstyleCss = require('./style/navstyle')
const iconsCss = require('./style/icons')
const paragraphsCss = {
  spaced: require('./style/paragraphs-spaced'),
  indented: require('./style/paragraphs-indented'),
  indentedall: require('./style/paragraphs-indentedall')
}

paragraphsCss.both = paragraphsCss.indented + '\n' + paragraphsCss.spaced

export { styleCss, coverstyleCss, titlestyleCss, navstyleCss, iconsCss, paragraphsCss }
