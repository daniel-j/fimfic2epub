
import FimFic2Epub from './FimFic2Epub'
import { saveAs } from 'file-saver'

function blobToDataURL (blob, callback) {
  let a = new FileReader()
  a.onloadend = function (e) { callback(a.result) }
  a.readAsDataURL(blob)
}

const STORY_ID = document.location.pathname.match(/^\/story\/(\d*)/)[1]

const ffc = new FimFic2Epub(STORY_ID)

const epubButton = document.querySelector('.story_container ul.chapters li.bottom a[title="Download Story (.epub)"]')

if (epubButton) {
  epubButton.addEventListener('click', function (e) {
    e.preventDefault()
    ffc.download().then(() => {
      ffc.getFile().then((file) => {
        console.log('Saving file...')
        if (typeof safari !== 'undefined') {
          blobToDataURL(file, (dataurl) => {
            document.location.href = dataurl
            alert('Add .epub to the filename of the downloaded file')
          })
        } else {
          saveAs(file, ffc.filename)
        }
      })
    })
  }, false)
}
