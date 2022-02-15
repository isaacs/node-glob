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

t.test('.', async t => {
  var g = new glob.Glob('/b*/**', { root: '.' })
  t.same(await g.results, [])
  cacheCheck(g, t)
})


t.test('a', async t => {
  var g = new glob.Glob('/b*/**', { root: path.resolve('a') })
  var wanted = [
    '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f'
  ].map(function (m) {
    return path.join(path.resolve('a'), m).replace(/\\/g, '/')
  })

  t.same(await g.results, wanted)
  cacheCheck(g, t)
})

t.test('root=a, cwd=a/b', async t => {
  var g = new glob.Glob('/b*/**', { root: 'a', cwd: path.resolve('a/b') })
  t.same(await g.results, [ '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f' ].map(function (m) {
    return path.join(path.resolve('a'), m).replace(/\\/g, '/')
  }))
  cacheCheck(g, t)
})

t.test('combined with absolute option', async t => {
  var g = new glob.Glob('/b*/**', { root: path.resolve('a'), absolute: true })
  t.same(await g.results, [ '/b', '/b/c', '/b/c/d', '/bc', '/bc/e', '/bc/e/f' ].map(function (m) {
    return path.join(path.resolve('a'), m).replace(/\\/g, '/')
  }))
  cacheCheck(g, t)
})

t.test('cwd when root=a, absolute=true', async t => {
   var g = new glob.Glob('/b*/**', { root: path.resolve('a'), absolute: true })
  t.same(g.cwd, process.cwd().replace(/\\/g, '/'))
})

t.test('cwd when root=a, absolute=true, cwd=__dirname', async t => {
  var g = new glob.Glob('/b*/**', { root: path.resolve('a'), absolute: true, cwd: __dirname })
  t.same(g.cwd, __dirname.replace(/\\/g, '/'))
})
