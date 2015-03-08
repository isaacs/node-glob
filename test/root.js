require("./global-leakage.js")
var t = require("tap")

process.chdir(__dirname)

var glob = require('../')
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

t.test('.', function (t) {
  var g = glob('/b*/**', { root: '.' }, function (er, matches) {
    t.ifError(er)
    t.like(matches, [])
    cacheCheck(g, t)
    t.end()
  })
})


t.test('a', function (t) {
  var g = glob('/b*/**', { root: path.resolve('a') }, function (er, matches) {
    t.ifError(er)
    var wanted = [
        '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f'
      ].map(function (m) {
        return path.join(path.resolve('a'), m).replace(/\\/g, '/')
      })

    t.like(matches, wanted)
    cacheCheck(g, t)
    t.end()
  })
})

t.test('root=a, cwd=a/b', function (t) {
  var g = glob('/b*/**', { root: 'a', cwd: path.resolve('a/b') }, function (er, matches) {
    t.ifError(er)
    t.like(matches, [ '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f' ].map(function (m) {
      return path.join(path.resolve('a'), m).replace(/\\/g, '/')
    }))
    cacheCheck(g, t)
    t.end()
  })
})
