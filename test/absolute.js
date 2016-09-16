require('./global-leakage.js')
var test = require('tap').test
var Glob = require('../').Glob
var common = require('../common.js')
var pattern = 'a/b/**';
var bashResults = require('./bash-results.json')
var isAbsolute = require('path-is-absolute')
process.chdir(__dirname + '/fixtures')

test('Emits absolute matches if option set', function (t) {
  var g = new Glob(pattern, { absolute: true })

  var matchCount = 0
  g.on('match', function (m) {
    t.ok(isAbsolute(m), 'must be absolute')
    matchCount++
  })

  g.on('end', function () {
    t.equal(matchCount, bashResults[pattern].length, 'must match all files')
    t.end()
  })
})
