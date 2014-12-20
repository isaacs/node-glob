require("./global-leakage.js")
var Glob = require("../glob.js").Glob
var GlobSync = require("../sync.js").GlobSync
var test = require('tap').test
var path = require('path')
var fs = require('fs')
var pattern = '**/g.js'
var symlinkTo = path.join(__dirname, 'a/symlink2')
var symlinkFrom = path.join(__dirname, '../examples')

test('globstar should match symlinks', function(t) {
  fs.symlinkSync(symlinkFrom, symlinkTo)
  var g = new Glob(pattern, { cwd: __dirname, realpath: true })
  var matches = []
  g.on('match', function (m) {
    matches.push(m)
  })
  g.on('end', function() {
    fs.unlink(symlinkTo)
    t.equal(matches.length, 1)
    t.end()
  })
})

test('sync globstar should match symlinks', function(t) {
  fs.symlinkSync(symlinkFrom, symlinkTo)
  var g = new GlobSync(pattern, { cwd: __dirname, realpath: true })
  fs.unlink(symlinkTo)
  t.equal(g.found.length, 1)
  t.end()
})