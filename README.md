[![NPM](https://nodei.co/npm/fimfic2epub.png?compact=true)](https://www.npmjs.com/package/fimfic2epub)

fimfic2epub
===========

This is a tool to generate better EPUB ebooks from [fimfiction](https://fimfiction.net/) stories. It's also a Chrome/Firefox extension, replacing the default EPUB download option with this tool.

[Screenshot](http://i.imgbox.com/MalEBiuC.png) of the Chrome extension

Demo
----
You can have a look at what a generated EPUB looks like [here](http://books.djazz.se/?epub=epub_content%2Fsummer_island). It was generated from the story [Summer Island](https://fimfiction.net/story/289663/summer-island).


Usage (browser extension)
-----------------
You can download the Chome extension from [Chrome Web Store](https://chrome.google.com/webstore/detail/fimfic2epub/fiijkoniocipeemlflajmmaecfhfcand) and [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/fimfic2epub/)


Installation & usage (command line)
-------------------
You can install the tool by running `npm install -g fimfic2epub`. You can then run it like this:

`$ fimfic2epub <story id/url> [<optional filename>]`

By default the EPUB will be saved in the current working directory with the filename `Title by Author.epub`. Run `fimfic2epub --help` to see a list of all flags.


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
Make sure [Node.js](https://nodejs.org) is installed. After you've cloned this repository, run `npm install` and `npm run build` to build it. This project uses [gulp](http://gulpjs.com/). Run `npm run dev` for a quicker development build. You can add `watch` to both for automatic rebuilding.


Development
-----------
Make sure [gulp is installed](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md).

When working on the code and testing it in a web browser as an extension, you can run gulp in watch mode: `gulp watch`. This will lint code and build it when you save. To build, just run `gulp` or `npm run build`. To lint, run `gulp lint` and to clean, run `gulp clean`.
