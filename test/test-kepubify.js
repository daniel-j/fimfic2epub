require('babel-register')
// use a mock DOM so we can run mithril on the server
require('mithril/test-utils/browserMock')(global)

const kepubify = require('../src/kepubify').default

console.log(1, kepubify(`<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html><body>text <p>aaaa</p><p>Some text. Woo <!-- or --> not. Here is <img /> another sentence.</p><!-- comment --><p>More text <img/> tail</p> body tail</body> html tail</html>`) === `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html><body>text <div class="book-inner"><div class="book-columns"><p><span class="koboSpan" id="kobo.1.0">aaaa</span></p><p><span class="koboSpan" id="kobo.2.0">Some text.</span><span class="koboSpan" id="kobo.2.1"> Woo not.</span><span class="koboSpan" id="kobo.2.2"> Here is </span><span class="koboSpan" id="kobo.2.4"> another sentence.</span><span class="koboSpan" id="kobo.2.3"><img /></span></p><p><span class="koboSpan" id="kobo.3.0">More text </span><span class="koboSpan" id="kobo.3.2"> tail</span><span class="koboSpan" id="kobo.3.1"><img /></span></p><span class="koboSpan" id="kobo.3.3"> body tail</span></div></div></body></html>`)

console.log(2, kepubify(`<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html><body><p>Dated: June 5th. Wohoo</p></body></html>`) === `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html><body><div class="book-inner"><div class="book-columns"><p><span class="koboSpan" id="kobo.1.0">Dated:</span><span class="koboSpan" id="kobo.1.1"> June 5th.</span><span class="koboSpan" id="kobo.1.2"> Wohoo</span></p></div></div></body></html>`)
