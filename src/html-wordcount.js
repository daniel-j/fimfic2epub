import htmlToText from 'html-to-text'
import matchWords from 'match-words'

export default function htmlWordCount (html) {
  let text = htmlToText.fromString(html, {
    wordwrap: false,
    ignoreImage: true,
    ignoreHref: true
  })

  return matchWords(text).length
}
