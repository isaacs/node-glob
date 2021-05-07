require("./global-leakage.js")

if (process.platform === "win32")
    return

var glob = require('../')
var test = require('tap').test
var Stats = require('fs').Stats
var dir = __dirname + '/fixtures'

test('noresolve async', function(t) {
  var g = new glob.Glob('a/symlink/a/b/c', { stat: true, cwd: dir, noresolve: true })
  g.on('stat', function(m, st) {
    t.ok(st instanceof Stats)
    t.ok(st.isSymbolicLink())
  })
  g.on('end', function(eof) {
    t.end()
  })
})

test('noresolve sync', function(t) {
  var g = new glob.GlobSync('a/symlink/a/b/c', { stat: true, cwd: dir, noresolve: true })
  Object.keys(g.statCache).forEach(function(k) {
    var st = g.statCache[k]
    t.ok(st instanceof Stats)
    t.ok(st.isSymbolicLink())
  });
  t.end()
})
