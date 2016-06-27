
import FimFic2Epub from './FimFic2Epub'

const STORY_ID = document.location.pathname.match(/^\/story\/(\d*)/)[1]

const ffc = new FimFic2Epub(STORY_ID)

const epubButton = document.querySelector('.story_container ul.chapters li.bottom a[title="Download Story (.epub)"]')

if (epubButton) {
  epubButton.addEventListener('click', function (e) {
    e.preventDefault()
    ffc.download()
  }, false)
}
