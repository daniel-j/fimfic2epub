#!/usr/bin/env node
'use strict'

const fs = require('fs')

const m = require('mithril')
const render = require('./mithril-node-render')
const pretty = require('pretty')

//const parse5 = require('parse5')
//const xmlserializer = require('xmlserializer')

const JSZip = require('jszip')

const zip = new JSZip()

zip.file('mimetype', 'application/epub+zip')

zip.folder('META-INF').file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
	<rootfiles>
		<rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
	</rootfiles>
</container>
`)



//let html = fs.readFileSync('test.xhtml', 'utf8')


//let dom = parse5.parseFragment(html)


//let frag = parse5.parseFragment('<package version="3.0">Hello</package>')
//console.log(frag.childNodes[0])

const NS = {
	OPF: 'http://www.idpf.org/2007/opf',
	OPS: 'http://www.idpf.org/2007/ops',
	DC: 'http://purl.org/dc/elements/1.1/',
	DAISY: 'http://www.daisy.org/z3986/2005/ncx/',
	XHTML: 'http://www.w3.org/1999/xhtml'
}

/*function attrs(a) {
	let arr = []
	for (let i in a) {
		arr.push({name: i, value: a[i]})
	}
	return arr
}

const dom = parse5.treeAdapters.default

let opf = dom.createDocumentFragment()

let packageNode = dom.createElement('package', NS, attrs({
	version: '3.0',
	'unique-identifier': 'BookId'
}))
let metadataNode = dom.createElement('metadata', NS, attrs({
	'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
	'xmlns:opf': 'http://www.idpf.org/2007/opf'
}))
let dcIdentifier = dom.createElement('dc:identifier', NS, attrs({id: 'BookId'}))
dom.insertText(dcIdentifier, 'urn:uuid:'+12345)
dom.appendChild(metadataNode, dcIdentifier)

dom.appendChild(packageNode, metadataNode)

dom.appendChild(opf, packageNode)

//console.log(xmlserializer.serializeToString(opf))
*/

let bookInfo = {
	uuid: 'urn:uuid:'+12345,
	title: 'Book title',
	author: 'Author',
	publishDate: '2016-06-19',
	lastModifiedDate: '2016-06-18T16:32:40Z'
}


function subjects(s) {
	var list = []
	for (let i = 0; i < s.length; i++) {
		list.push(m('dc:subject', s[i]))
	}
	return list
}

let contentOpf = '<?xml version="1.0" encoding="utf-8"?>\n'+pretty(render(
	m('package', {xmlns: NS.OPF, version: '3.0', 'unique-identifier': 'BookId'}, [
		m('metadata', {'xmlns:dc': NS.DC, 'xmlns:opf': NS.OPF}, [
			m('dc:identifier', {id: 'BookId'}, bookInfo.uuid),
			m('dc:title', bookInfo.title),
			m('dc:creator', {id: 'cre'}, bookInfo.author),
			m('meta', {refines: '#cre', property: 'role', scheme: 'marc:relators'}, 'aut'),
			m('dc:date', bookInfo.publishDate),
			m('dc:publisher', 'Fimfiction'),
			m('dc:source', 'http://fimfiction.net/story/'+'STORY_ID'),
			m('dc:language', 'en'),
			m('meta', {property: 'dcterms:modified'}, bookInfo.lastModifiedDate)

		].concat(subjects(['Fiction', 'Pony']))),

		m('manifest', [
			m('item', {id: 'ncx', href: 'toc.ncx', 'media-type': 'application/x-dtbncx+xml'}),
			m('item', {id: 'nav', 'href': 'nav.xhtml', 'media-type': 'application/xhtml+xml', properties: 'nav'})
		]),

		m('spine', {toc: 'ncx'}, [
			m('itemref', {idref: 'nav'})
		]),

		false? m('guide', [

		]):null
	])
))
zip.file('content.opf', contentOpf)

function navPoints(list) {
	var arr = []
	for (let i = 0; i < list.length; i++) {
		list[i]
		arr.push(m('navPoint', {id: 'navPoint-'+(i+1), playOrder: i+1}, [
			m('navLabel', m('text', list[i][0])),
			m('content', {src: list[i][1]})
		]))
	}
	return arr
}

let tocNcx = `<?xml version="1.0" encoding="utf-8" ?>\n`+pretty(render(
	m('ncx', {version: '2005-1', xmlns: NS.DAISY}, [
		m('head', [
			m('meta', {content: bookInfo.uuid, name: 'dtb:uid'}),
			m('meta', {content: 0, name: 'dtb:depth'}),
			m('meta', {content: 0, name: 'dtb:totalPageCount'}),
			m('meta', {content: 0, name: 'dtb:maxPageNumber'})
		]),
		m('docTitle', m('text', bookInfo.title)),
		m('navMap', navPoints([
			['Contents', 'nav.xhtml']
		]))
	])
))
zip.file('toc.ncx', tocNcx)


let navDocument = `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n\n`+pretty(render(
	m('html', {xmlns: NS.XHTML, 'xmlns:epub': NS.OPS, lang: 'en', 'xml:lang': 'en'}, [
		m('head', [
			m('meta', {charset: 'utf-8'}),
			//m('link', {rel: 'stylesheet', type: 'text/css', href: 'styles.css'}),
			m('title', 'Contents')
		]),
		m('body', [
			m('nav', {'epub:type': 'toc', id: 'toc'}, [
				m('h1', 'Contents'),
				m('ol', [])
			])
		])
	])
))
zip.file('nav.xhtml', navDocument)

zip
	.generateNodeStream({
		type: 'nodebuffer',
		streamFiles: true,
		mimeType: 'application/epub+zip',
		compression: 'DEFLATE',
		compressionOptions: {level: 9}
	})
	.pipe(fs.createWriteStream('out.epub'))
	.on('finish', function () {
		// JSZip generates a readable stream with a "end" event,
		// but is piped here in a writable stream which emits a "finish" event.
		console.log("out.epub written.");
})

/*
let promise = null
if (JSZip.support.uint8array) {
	promise = zip.generateAsync({type : 'uint8array', mimeType: 'application/epub+zip'})
} else {
	promise = zip.generateAsync({type : 'string', mimeType: 'application/epub+zip'})
}

promise.then((zip) => {
	console.log(zip)
})
*/

/*
const tidy = require("tidy-html5").tidy_html5


let content = fs.readFileSync("test.xhtml")

let result = tidy(content, {
	"indent": "auto",
	"numeric-entities": "yes",
	"output-xhtml": "yes",
	"alt-text": "Image",
	"wrap": "0",
	"quiet": "yes"
})


console.log(result)
*/
