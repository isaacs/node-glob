require("./global-leakage.js")
var t = require("tap")

process.chdir(__dirname + '/fixtures')

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

t.test('.', function (t) {
  var g = glob('/b*/**', { root: '.' }, function (er, matches) {
    t.error(er)
    t.same(matches, [])
    cacheCheck(g, t)
    t.end()
  })
})


t.test('a', function (t) {
  var g = glob('/b*/**', { root: path.resolve('a') }, function (er, matches) {
    t.error(er)
    var wanted = [
        '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f'
      ].map(function (m) {
        return path.join(path.resolve('a'), m).replace(/\\/g, '/')
      })

    t.same(matches, wanted)
    cacheCheck(g, t)
    t.end()
  })
})

t.test('root=a, cwd=a/b', function (t) {
  var g = glob('/b*/**', { root: 'a', cwd: path.resolve('a/b') }, function (er, matches) {
    t.error(er)
    t.same(matches, [ '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f' ].map(function (m) {
      return path.join(path.resolve('a'), m).replace(/\\/g, '/')
    }))
    cacheCheck(g, t)
    t.end()
  })
})

t.test('combined with absolute option', function(t) {
  var g = glob('/b*/**', { root: path.resolve('a'), absolute: true }, function (er, matches) {
    t.error(er)
    t.same(matches, [ '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f' ].map(function (m) {
      return path.join(path.resolve('a'), m).replace(/\\/g, '/')
    }))
    cacheCheck(g, t)
    t.end()
  })
})

t.test('cwdAbs when root=a, absolute=true', function(t) {
   var g = glob('/b*/**', { root: path.resolve('a'), absolute: true }, function (er, matches) {
    t.error(er)
    t.same(g.cwdAbs, process.cwd().replace(/\\/g, '/'))
    t.end()
  })
})

t.test('cwdAbs when root=a, absolute=true, cwd=__dirname', function(t) {
   var g = glob('/b*/**', { root: path.resolve('a'), absolute: true, cwd: __dirname }, function (er, matches) {
    t.error(er)
    t.same(g.cwdAbs, __dirname.replace(/\\/g, '/'))
    t.end()
  })
})
