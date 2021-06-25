require("./global-leakage.js")
var tap = require("tap")
var glob = require('../')
var path = require('path')
var isAbsolute = require('path-is-absolute')

function cacheCheck(g, t) {
  // verify that path cache keys are all absolute
  var caches = [ 'cache', 'statCache', 'symlinks' ]
  caches.forEach(function (c) {
    Object.keys(g[c]).forEach(function (p) {
      t.ok(isAbsolute(p), p + ' should be absolute')
    })
  })
}

process.chdir(__dirname + '/fixtures')

tap.test("changing root and searching for /b*/**", function (t) {
  t.test('.', function (t) {
    var g = glob('/b*/**', { root: '.', nomount: true }, function (er, matches) {
      t.error(er)
      t.same(matches, [])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('a', function (t) {
    var g = glob('/b*/**', { root: path.resolve('a'), nomount: true }, function (er, matches) {
      t.error(er)
      t.same(matches, [ '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('root=a, cwd=a/b', function (t) {
    var g = glob('/b*/**', { root: 'a', cwd: path.resolve('a/b'), nomount: true }, function (er, matches) {
      t.error(er)
      t.same(matches, [ '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.end()
})
