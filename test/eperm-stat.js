require("./global-leakage.js")
var dir = __dirname + '/fixtures'

var fs = require('fs')
var expect = [
  'a/abcdef',
  'a/abcdef/g',
  'a/abcdef/g/h',
  'a/abcfed',
  'a/abcfed/g',
  'a/abcfed/g/h'
]

var lstat = fs.lstat
var lstatSync = fs.lstatSync
var badPaths = /\ba[\\\/]?$|\babcdef\b/

fs.lstat = function (path, cb) {
  // synthetically generate a non-ENOENT error
  if (badPaths.test(path)) {
    var er = new Error('synthetic')
    er.code = 'EPERM'
    return process.nextTick(cb.bind(null, er))
  }

  return lstat.call(fs, path, cb)
}

fs.lstatSync = function (path) {
  // synthetically generate a non-ENOENT error
  if (badPaths.test(path)) {
    var er = new Error('synthetic')
    er.code = 'EPERM'
    throw er
  }

  return lstatSync.call(fs, path)
}

var glob = require('../')
var t = require('tap')

t.test('stat errors other than ENOENT are ok', function (t) {
  t.plan(2)
  t.test('async', function (t) {
    glob('a/*abc*/**', { stat: true, cwd: dir }, function (er, matches) {
      if (er)
        throw er
      t.same(matches, expect)
      t.end()
    })
  })

  t.test('sync', function (t) {
    var matches = glob.sync('a/*abc*/**', { stat: true, cwd: dir })
    t.same(matches, expect)
    t.end()
  })
})

t.test('globstar with error in root', function (t) {
  var expect = [
    'a',
    'a/abcdef',
    'a/abcdef/g',
    'a/abcdef/g/h',
    'a/abcfed',
    'a/abcfed/g',
    'a/abcfed/g/h',
    'a/b',
    'a/b/c',
    'a/b/c/d',
    'a/bc',
    'a/bc/e',
    'a/bc/e/f',
    'a/c',
    'a/c/d',
    'a/c/d/c',
    'a/c/d/c/b',
    'a/cb',
    'a/cb/e',
    'a/cb/e/f',
    'a/symlink',
    'a/symlink/a',
    'a/symlink/a/b',
    'a/symlink/a/b/c',
    'a/x',
    'a/z'
  ]
  if (process.platform === 'win32') {
    expect = expect.filter(function(path) {
      return path.indexOf('/symlink') === -1
    })
  }

  var pattern = 'a/**'
  t.plan(2)
  t.test('async', function (t) {
    glob(pattern, { cwd: dir }, function (er, matches) {
      if (er)
        throw er
      t.same(matches, expect)
      t.end()
    })
  })

  t.test('sync', function (t) {
    var matches = glob.sync(pattern, { cwd: dir })
    t.same(matches, expect)
    t.end()
  })
})
