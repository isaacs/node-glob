//TODO(isaacs) Remove in version 6

require("./global-leakage.js")
// Negation test
// Show that glob respect's minimatch's negate flag

var glob = require('../glob.js')
var test = require('tap').test

process.chdir(__dirname)
test('glob respects minimatch negate flag when activated with leading !', function(t) {
  var expect = ["abcdef/g", "abcfed/g", "c/d", "cb/e"]

  if (process.platform !== 'win32')
    expect.push('symlink/a')

  var opt = { cwd: 'a', nonegate: false }
  var warning = null
  var ce = console.error
  console.error = function (msg) {
    warning = require('util').format.apply(null, arguments)
  }
  var results = glob("!b**/*", opt, function (er, results) {
    if (er)
      throw er

    console.error = ce
    t.same(warning, 'glob WARNING: comments and negation will be disabled in v6')
    t.same(results, expect)
    t.throws(function () {
      process.throwDeprecation = true
      require('../common.js').deprecationWarned = false
      glob('!x', opt, function () {})
    })
    t.end()
  });
});
