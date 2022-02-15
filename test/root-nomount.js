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
  t.test('.', async t => {
    var g = new glob.Glob('/b*/**', { root: '.', nomount: true })
    t.same(await g.results, [])
    cacheCheck(g, t)
  })

  t.test('a', async t => {
    var g = new glob.Glob('/b*/**', { root: path.resolve('a'), nomount: true })
    t.same(await g.results, [ '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f' ])
    cacheCheck(g, t)
  })

  t.test('root=a, cwd=a/b', async t => {
    var g = new glob.Glob('/b*/**', { root: 'a', cwd: path.resolve('a/b'), nomount: true })
    t.same(await g.results, [ '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f' ])
    cacheCheck(g, t)
  })

  t.end()
})
