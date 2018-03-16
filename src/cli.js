
const args = require('commander')
  .command('fimfic2epub <story> [filename]')
  .description(require('../package.json').description)
  .version(require('../package.json').version)
  .option('-d, --dir <path>', 'Directory to store ebook in. Is prepended to filename')
  .option('-t, --title <value>', 'Set the title of the story')
  .option('-a, --author <value>', 'Set the author of the story')
  .option('-T, --typogrify', 'Enable typographic fixes (smart quotes, dashes, ellipsis, ordinal)')
  .option('-c, --no-comments-link', 'Don\'t add link to online comments')
  .option('-H, --no-headings', 'Don\'t add headings to chapters')
  .option('-b, --no-bars', 'Don\'t add chapter bars to show reading progress')
  .option('-r, --no-reading-ease', 'Don\'t calculate Flesch reading ease')
  .option('-e, --no-external', 'Don\'t embed external resources, such as images (breaks EPUB spec)')
  .option('-n, --no-notes', 'Don\'t include author notes')
  .option('-i, --notes-index', 'Create an index with all author notes at the end of the ebook')
  .option('-p, --paragraphs <style>', 'Select a paragraph style <spaced|indented|indentedall|both>', 'spaced')
  .option('-j, --join-subjects', 'Join dc:subjects to a single value')
  .option('-w, --wpm <number>', 'Words per minute. Set to 0 to disable reading time estimations', parseInt, 200)
  .option('-C, --cover <url>', 'Set cover image url')
  .parse(process.argv)

if (args.args.length < 1) {
  console.error('Error: No story id/url provided')
  process.exit(1)
}

const outputStdout = args.args[1] === '-' || args.args[1] === '/dev/stdout'

if (outputStdout) {
  console.log = console.error
  console.log('Outputting to stdout')
}

// use a mock DOM so we can run mithril on the server
require('mithril/test-utils/browserMock')(global)

const htmlToText = require('./utils').htmlToText
const FimFic2Epub = require('./FimFic2Epub').default
const fs = require('fs')
const path = require('path')

const STORY_ID = args.args[0]

const ffc = new FimFic2Epub(STORY_ID, {
  typogrify: !!args.typogrify,
  addCommentsLink: !!args.commentsLink,
  includeAuthorNotes: !!args.notes,
  useAuthorNotesIndex: !!args.notesIndex,
  addChapterHeadings: !!args.headings,
  includeExternal: !!args.external,
  paragraphStyle: args.paragraphs,
  joinSubjects: !!args.joinSubjects,
  calculateReadingEase: !!args.readingEase,
  readingEaseWakeupInterval: 800,
  wordsPerMinute: args.wpm,
  addChapterBars: !!args.bars
})
ffc.coverUrl = args.cover

ffc.fetchMetadata()
.then(() => {
  if (args.title) {
    ffc.setTitle(args.title)
  }
  if (args.author) {
    ffc.setAuthorName(args.author)
  }
  ffc.storyInfo.short_description = htmlToText(ffc.storyInfo.description)
})
.then(ffc.fetchAll.bind(ffc))
.then(ffc.build.bind(ffc))
.then(() => {
  let filename = (args.args[1] || '').replace('%id%', ffc.storyInfo.id) || ffc.filename
  let stream

  if (args.dir) {
    filename = path.join(args.dir, filename)
  }

  if (outputStdout) {
    stream = process.stdout
  } else {
    stream = fs.createWriteStream(filename)
  }
  ffc.streamFile(null)
  .pipe(stream)
  .on('finish', () => {
    if (!outputStdout) {
      console.log('Saved story as ' + filename)
    }
  })
})
.catch((err) => {
  if (err && err.stack) {
    console.error(err.stack)
  } else {
    console.error('Error: ' + (err || 'Unknown error'))
  }
  process.exit(1)
})
