[![NPM](https://nodei.co/npm/fimfic2epub.png?compact=true)](https://www.npmjs.com/package/fimfic2epub)


fimfic2epub
===========
This is a tool to generate better EPUB ebooks from [Fimfiction](https://fimfiction.net/) stories. It's also a Chrome/Firefox extension, replacing the default EPUB download option with this tool.

[Screenshot](http://i.imgbox.com/MalEBiuC.png) of the web extension


Features
--------
* The generated ebook is in modern EPUB3 format with fallbacks for older EPUB2 reading systems
* Improved styling and formatting of content compared to Fimfiction's export options
* Cover image can be changed from an image file or url
* Downloads and embeds artwork from the story inside the EPUB file, including YouTube thumbnails, for optimal offline reading and archiving (optional)
* Rating, tags, status, story description and more info are available on the title page
* The table of contents page includes chapter modification dates and word counts
* Option to put all author notes in an index at the end of the ebook
* Option to not add a title heading for chapters (in case the story has its own)
* Tweak paragraph style from double-spaced to indented (similar to book typesetting, may not look good on every story)
* Emoji, icon and webp support (webp images gets converted to png)
* Calculate the [Flesch reading ease](https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests#Flesch_reading_ease) value of the story
* Customize metadata of the generated ebook, such as title, author, subjects and description
* Command line tool with same features as the web extension


Demo
----
You can have a look at what a generated EPUB looks like [here](http://books.djazz.se/?epub=epub_content%2Fsummer_island). It was generated from the story [Summer Island](https://fimfiction.net/story/289663/summer-island).


Usage (web extension)
-----------------
You can download the Chome extension from [Chrome Web Store](https://chrome.google.com/webstore/detail/fimfic2epub/fiijkoniocipeemlflajmmaecfhfcand) and [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/fimfic2epub/)


Installation & usage (command line)
-------------------
You can install the tool by running `npm install -g fimfic2epub`. You can then run it like this:

`$ fimfic2epub <story id/url> [<optional filename>]`

By default the EPUB will be saved in the current working directory with the filename `Title by Author.epub`. Run `fimfic2epub -h` to see a list of all flags.

```
  Usage: fimfic2epub [options] <story> [filename]

  Tool to generate improved EPUB ebooks from Fimfiction stories

  Options:

    -V, --version             output the version number
    -d, --dir <path>          Directory to store ebook in. Is prepended to filename
    -t, --title <value>       Set the title of the story
    -a, --author <value>      Set the author of the story
    -c, --no-comments-link    Don't add link to online comments
    -H, --no-headings         Don't add headings to chapters
    -r, --no-reading-ease     Don't calculate Flesch reading ease
    -e, --no-external         Don't embed external resources, such as images (breaks EPUB spec)
    -n, --no-notes            Don't include author notes
    -i, --notes-index         Create an index with all author notes at the end of the ebook
    -p, --paragraphs <style>  Select a paragraph style <spaced|indented|indentedall|both> (default: spaced)
    -j, --join-subjects       Join dc:subjects to a single value
    -C, --cover <url>         Set cover image url
    -h, --help                output usage information
```

Examples
--------
```
Download with automatic filename:
$ fimfic2epub 289663
$ fimfic2epub https://www.fimfiction.net/story/289663/summer-island

Download and save to a specified dir/filename:
$ fimfic2epub 289663 path/to/file.epub
$ fimfic2epub --dir path/to/my/dir 289663 ebook_%id%.epub # %id% gets replaced by the story id
```


Building
--------
Make sure [Node.js](https://nodejs.org) is installed. After you've cloned this repository, run `npm install` and `npm run build` to build it. This project uses [gulp](http://gulpjs.com/).


Development
-----------
When developing the code, you can run `npm run dev watch`. This will rebuild the code quickly and lint it when you save. To just lint, run `npm run dev lint` and to clean, run `npm run dev clean`. To build for production, just run `npm run build`.

To test the Chrome extension, click Load Unpacked and pick the `extension/` directory. To test the Firefox extension, go to Add-ons and Debug Add-ons. Then Load Temporary Add-on and pick the `extension.xpi` file. To reload them after a rebuild, click the Reload button in Chrome and/or Firefox.
