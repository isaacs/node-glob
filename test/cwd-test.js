require("./global-leakage.js")
var tap = require("tap")

var origCwd = process.cwd()
process.chdir(__dirname)
var path = require('path')
var common = require('../common.js')
function cacheCheck(g, t) {
  // verify that path cache keys are all absolute
  var caches = [ 'cache', 'statCache', 'symlinks' ]
  caches.forEach(function (c) {
    Object.keys(g[c]).forEach(function (p) {
      t.ok(common.isAbsolute(p), p + ' should be absolute')
    })
  })
}

tap.test("changing cwd and searching for **/d", function (t) {
  var glob = require('../')
  t.test('.', function (t) {
    var g = glob('**/d', function (er, matches) {
      t.ifError(er)
      t.like(matches, [ 'a/b/c/d', 'a/c/d' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('a', function (t) {
    var g = glob('**/d', {cwd:path.resolve('a')}, function (er, matches) {
      t.ifError(er)
      t.like(matches, [ 'b/c/d', 'c/d' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('a/b', function (t) {
    var g = glob('**/d', {cwd:path.resolve('a/b')}, function (er, matches) {
      t.ifError(er)
      t.like(matches, [ 'c/d' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('a/b/', function (t) {
    var g = glob('**/d', {cwd:path.resolve('a/b/')}, function (er, matches) {
      t.ifError(er)
      t.like(matches, [ 'c/d' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('.', function (t) {
    var g = glob('**/d', {cwd: process.cwd()}, function (er, matches) {
      t.ifError(er)
      t.like(matches, [ 'a/b/c/d', 'a/c/d' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('cd -', function (t) {
    process.chdir(origCwd)
    t.end()
  })

  t.end()
})
