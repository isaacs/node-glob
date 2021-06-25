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
  t.test('.', function (t) {
    var g = glob('**/d', function (er, matches) {
      t.error(er)
      t.match(matches, [ 'a/b/c/d', 'a/c/d' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('a', function (t) {
    var g = glob('**/d', {cwd:path.resolve('a')}, function (er, matches) {
      t.error(er)
      t.match(matches, [ 'b/c/d', 'c/d' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('a/b', function (t) {
    var g = glob('**/d', {cwd:path.resolve('a/b')}, function (er, matches) {
      t.error(er)
      t.match(matches, [ 'c/d' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('a/b/', function (t) {
    var g = glob('**/d', {cwd:path.resolve('a/b/')}, function (er, matches) {
      t.error(er)
      t.match(matches, [ 'c/d' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.test('.', function (t) {
    var g = glob('**/d', {cwd: process.cwd()}, function (er, matches) {
      t.error(er)
      t.match(matches, [ 'a/b/c/d', 'a/c/d' ])
      cacheCheck(g, t)
      t.end()
    })
  })

  t.end()
})

tap.test('non-dir cwd should raise error', function (t) {
  var notdir = 'a/b/c/d'
  var notdirRE = /a[\\\/]b[\\\/]c[\\\/]d/
  var abs = path.resolve(notdir)
  var expect = new Error('ENOTDIR invalid cwd ' + abs)
  expect.code = 'ENOTDIR'
  expect.path = notdirRE
  expect.stack = undefined
  var msg = 'raise error when cwd is not a dir'

  t.throws(function () {
    glob.sync('*', { cwd: notdir })
  }, expect)
  glob('*', { cwd: notdir }, function (er, results) {
    t.match(er, expect)
    t.end()
  })
})

tap.test('cd -', function (t) {
  process.chdir(origCwd)
  t.end()
})
