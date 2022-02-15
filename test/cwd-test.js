require("./global-leakage.js")
var tap = require("tap")

var origCwd = process.cwd()
process.chdir(__dirname + '/fixtures')
var path = require('path')
var isAbsolute = require('path-is-absolute')
var glob = require('../')

function cacheCheck(g, t) {
  // verify that path cache keys are all absolute
  var caches = [ 'cache', 'statCache', 'symlinks' ]
  caches.forEach(function (c) {
    Object.keys(g[c]).forEach(function (p) {
      t.ok(isAbsolute(p), p + ' should be absolute')
    })
  })
}

tap.test("changing cwd and searching for **/d", function (t) {
  t.test('.', async t => {
    const g = new glob.Glob('**/d')
    t.match(await g.results, [ 'a/b/c/d', 'a/c/d' ])
    cacheCheck(g, t)
    t.end()
  })

  t.test('a', async t => {
    const g = new glob.Glob('**/d', {cwd:path.resolve('a')})
    t.match(await g.results, [ 'b/c/d', 'c/d' ])
    cacheCheck(g, t)
  })

  t.test('a/b', async t => {
    const g = new glob.Glob('**/d', {cwd:path.resolve('a/b')})
    t.match(await g.results, [ 'c/d' ])
    cacheCheck(g, t)
  })

  t.test('a/b/', async t => {
    const g = new glob.Glob('**/d', {cwd:path.resolve('a/b/')})
    t.match(await g.results, [ 'c/d' ])
    cacheCheck(g, t)
  })

  t.test('.', async t => {
    const g = new glob.Glob('**/d', {cwd: process.cwd()})
    t.match(await g.results, [ 'a/b/c/d', 'a/c/d' ])
    cacheCheck(g, t)
  })

  t.end()
})

tap.test('non-dir cwd should raise error', async t => {
  const notdir = 'a/b/c/d'
  const notdirRE = /a[\\\/]b[\\\/]c[\\\/]d/
  const abs = path.resolve(notdir)
  const expect = new Error('ENOTDIR invalid cwd ' + abs)
  expect.code = 'ENOTDIR'
  expect.path = notdirRE
  expect.stack = undefined
  const msg = 'raise error when cwd is not a dir'

  t.throws(function () {
    glob.sync('*', { cwd: notdir })
  }, expect)
  await t.rejects(glob('*', { cwd: notdir }), expect)
})

tap.test('cd -', function (t) {
  process.chdir(origCwd)
  t.end()
})
