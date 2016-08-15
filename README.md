fimfic2epub
===========

This is a tool to generate better EPUB ebooks from [fimfiction](http://www.fimfiction.net/) stories. It's also a Chrome/Firefox extension, replacing the default EPUB download option with this tool.


Usage (browser extension)
-----------------

You can download the Chome extension from [Chrome Web Store](https://chrome.google.com/webstore/detail/fimfic2epub/fiijkoniocipeemlflajmmaecfhfcand).

Right now the addon is not available in Add-ons for Firefox, but it's fully compatible.


Installation & usage (command line)
-------------------

You can install the tool by running `npm install -g fimfic2epub`. You can then run it like this:

`$ fimfic2epub <story id/url> [<optional filename>]`

By default the EPUB will be saved in the current working directory with the filename `Title by Author.epub`. You can set filename to `-` and the epub will be emitted to stdout instead.

Examples
--------
```
Download with automatic filename:
$ fimfic2epub 180690
$ fimfic2epub https://www.fimfiction.net/story/180690/tag-test

Download and save to a specified filename:
$ fimfic2epub 180690 path/to/file.epub
$ fimfic2epub 180690 - > path/to/file.epub
```


Building
--------

Make sure [Node.js](https://nodejs.org) is installed. After you've cloned this repository, run `npm install` and `npm run build` to build it. This project uses [gulp](http://gulpjs.com/).


Development
-----------

Make sure [gulp is installed](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md).

When working on the code and testing it in a web browser as an extension, you can run gulp in watch mode: `gulp watch`. This will lint code and build it when you save. To build, just run `gulp` or `npm run build`. To lint, run `gulp lint` and to clean, run `gulp clean`.
