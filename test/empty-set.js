require("./global-leakage.js")
var test = require('tap').test
var glob = require("../")

// Patterns that cannot match anything
var patterns = [
  '# comment',
  ' ',
  '\n',
  'just doesnt happen to match anything so this is a control'
]

for (const p of patterns) {
  test(JSON.stringify(p), async t =>
    t.same(await glob(p), [], 'no returned values'))
}
