
export let NS = {
  OPF: 'http://www.idpf.org/2007/opf',
  OPS: 'http://www.idpf.org/2007/ops',
  DC: 'http://purl.org/dc/elements/1.1/',
  DAISY: 'http://www.daisy.org/z3986/2005/ncx/',
  XHTML: 'http://www.w3.org/1999/xhtml',
  SVG: 'http://www.w3.org/2000/svg',
  XLINK: 'http://www.w3.org/1999/xlink'
}

export let tidyOptions = {
  'indent': 'auto',
  'numeric-entities': 'yes',
  'output-xhtml': 'yes',
  'alt-text': 'Image',
  'wrap': '0',
  'quiet': 'yes',
  'show-warnings': 0,
  'newline': 'LF',
  'tidy-mark': 'no',
  'show-body-only': 'auto'
}

export let mimeMap = {
  'image/jpeg': 'Images/*.jpg',
  'image/png': 'Images/*.png',
  'image/gif': 'Images/*.gif'
}

export let containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`
