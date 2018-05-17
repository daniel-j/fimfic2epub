require('babel-register')
// use a mock DOM so we can run mithril on the server
require('mithril/test-utils/browserMock')(global)

const kepubify = require('../src/kepubify').default

console.log(1, kepubify(`<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html><body>text <p>aaaa</p><p>Some text. Woo <!-- or --> not. Here is <img /> another sentence.</p><!-- comment --><p>More text <img/> tail</p> body tail</body> html tail</html>`) === `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html><body>text <div class="book-inner"><div class="book-columns"><p><span class="koboSpan" id="kobo.1.1">aaaa</span></p><p><span class="koboSpan" id="kobo.2.1">Some text.</span><span class="koboSpan" id="kobo.2.2"> Woo not.</span><span class="koboSpan" id="kobo.2.3"> Here is </span><img /><span class="koboSpan" id="kobo.2.5"> another sentence.</span></p><p><span class="koboSpan" id="kobo.3.1">More text </span><img /><span class="koboSpan" id="kobo.3.3"> tail</span></p><span class="koboSpan" id="kobo.3.5"> body tail</span></div></div></body></html>`)

console.log(2, kepubify(`<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html><body><p>Dated: June 5th. Wohoo</p></body></html>`) === `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html><body><div class="book-inner"><div class="book-columns"><p><span class="koboSpan" id="kobo.1.1">Dated:</span><span class="koboSpan" id="kobo.1.2"> June 5th.</span><span class="koboSpan" id="kobo.1.3"> Wohoo</span></p></div></div></body></html>`)

console.log(3, kepubify(`<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html><body><pre>hello</pre><p>“Well, you know, Water Bearer and all,” she laughed weakly. “Don’t kid yourself, though. You’re <i>strong,</i> Daphne, and I’m not just saying that. You saved us, and you’ve come all this way through all these trials. If you get a little heartbroken now and again, well, you’re entitled to it. You’re like your mother in that.” She smiled brightly. “The Seer told me a bit about that, you know. The whole… thing passed down the female line, on and on for ages, all of them determined and gifted. <i>Apparently</i> that’s why things here resemble stuff on our earth so well—because the Everfree Ways have been following your maternal line all across Europe and the Americas, and apparently a brief stop at New Zealand. They were super adventurous.”</p></body></html>`) === `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html><body><div class="book-inner"><div class="book-columns"><pre>hello</pre><p><span class="koboSpan" id="kobo.1.1">“Well, you know, Water Bearer and all,” she laughed weakly.</span><span class="koboSpan" id="kobo.1.2"> “Don’t kid yourself, though.</span><span class="koboSpan" id="kobo.1.3"> You’re </span><i><span class="koboSpan" id="kobo.1.5">strong,</span></i><span class="koboSpan" id="kobo.1.7"> Daphne, and I’m not just saying that.</span><span class="koboSpan" id="kobo.1.8"> You saved us, and you’ve come all this way through all these trials.</span><span class="koboSpan" id="kobo.1.9"> If you get a little heartbroken now and again, well, you’re entitled to it.</span><span class="koboSpan" id="kobo.1.10"> You’re like your mother in that.”</span><span class="koboSpan" id="kobo.1.11"> She smiled brightly.</span><span class="koboSpan" id="kobo.1.12"> “The Seer told me a bit about that, you know.</span><span class="koboSpan" id="kobo.1.13"> The whole… thing passed down the female line, on and on for ages, all of them determined and gifted. </span><i><span class="koboSpan" id="kobo.1.15">Apparently</span></i><span class="koboSpan" id="kobo.1.17"> that’s why things here resemble stuff on our earth so well—because the Everfree Ways have been following your maternal line all across Europe and the Americas, and apparently a brief stop at New Zealand.</span><span class="koboSpan" id="kobo.1.18"> They were super adventurous.”</span></p></div></div></body></html>`)
