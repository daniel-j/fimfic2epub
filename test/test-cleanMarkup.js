require('babel-register')
// use a mock DOM so we can run mithril on the server
require('mithril/test-utils/browserMock')(global)

const cleanMarkup = require('../src/cleanMarkup').cleanMarkup

cleanMarkup(`<div class="bbcode-center" style="text-align:center"><p><a class="embed" href="https://www.youtube.com/watch?v=9OUX7fO8WpE&amp;list=PL_0tuhnCOvYYyEa8ejvkZrFzpbX3OJpJP&amp;index=24">https://www.youtube.com/watch?v=9OUX7fO8WpE&amp;list=PL_0tuhnCOvYYyEa8ejvkZrFzpbX3OJpJP&amp;index=24</a></p></div><p>Stay tuned, I'll be posting Part 2 (the real ultimate final chapter in which the story will be Complete) tomorrow morning.</p><p><b>Comment away anyway!</b></p><p>Some people have voiced concerns about Naomi's plan, namely how a conspiracy of that scale and nature can survive.<br/>I (and Naomi) understand that it is completely doomed to failure without Daphne's help (and help of other oracles like her.) Foretelling isn't a perfect discipline, but it <i>can</i> detect major fracture points like that.<br/>The society she will form will also help humanity by taking on supernatural threats, so this isn't a completely one-sided affair.</p>`).then((html) => {
	console.log(html)
}).catch((err) => {
	throw err
})
