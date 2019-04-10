
import styleCss from './style/style'
import coverstyleCss from './style/coverstyle'
import titlestyleCss from './style/titlestyle'
import navstyleCss from './style/navstyle'
import iconsCss from './style/icons'

import paragraphsSpaced from './style/paragraphs-spaced'
import paragraphsIndented from './style/paragraphs-indented'
import paragraphsIndentAll from './style/paragraphs-indentedall'

const paragraphsCss = {
  spaced: paragraphsSpaced,
  indented: paragraphsIndented,
  indentedall: paragraphsIndentAll
}

paragraphsCss.both = paragraphsCss.indented + '\n' + paragraphsCss.spaced

export { styleCss, coverstyleCss, titlestyleCss, navstyleCss, iconsCss, paragraphsCss }
