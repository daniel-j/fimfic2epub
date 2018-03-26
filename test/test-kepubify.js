require('babel-register')
// use a mock DOM so we can run mithril on the server
require('mithril/test-utils/browserMock')(global)

const kepubify = require('../src/kepubify').default

console.log(kepubify(`<html><body><p>Some text. Woo or not. Here is <img /> another sentence.</p></body></html>`))
