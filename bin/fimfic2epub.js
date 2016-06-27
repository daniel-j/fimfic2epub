#!/usr/bin/env node

require("babel-register")

// have to load these from the outside so webpack doesn't try to include them
process.fs = require('fs')
process.path = require('path')
process.request = require('request')
process.stylus = require('stylus')
process.tidy = require('tidy-html5').tidy_html5
process.sizeOf = require('image-size')

const FimFic2Epub = require('../src/FimFic2Epub').default

const STORY_ID = process.argv[2]

const ffc = new FimFic2Epub(STORY_ID)

ffc.download()
