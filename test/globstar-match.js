require("./global-leakage.js")
var Glob = require("../").Glob
var test = require('tap').test

test('globstar should not have dupe matches', async t => {
  var pattern = 'a/**/[gh]'
  var g = new Glob(pattern, { cwd: __dirname })
  var matches = []
  g.on('match', function(m) {
    matches.push(m)
  })
  g.on('end', function () {
    matches = matches.sort()
    const set = g.found.sort()
    t.same(matches, set, 'should have same set of matches')
  })
  g.resume()
  return g.promise()
})
