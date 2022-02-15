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

const {lstat, lstatSync, stat, statSync} = fs
const badPaths = /\ba[\\\/]?$|\babcdef\b/

fs.lstat = function (path, cb) {
  // synthetically generate a non-ENOENT error
  if (badPaths.test(path)) {
    var er = new Error('synthetic')
    er.code = 'EPERM'
    er.syscall = 'lstat'
    return process.nextTick(cb.bind(null, er))
  }

  return lstat.call(fs, path, cb)
}

fs.stat = function (path, cb) {
  // synthetically generate a non-ENOENT error
  if (badPaths.test(path)) {
    var er = new Error('synthetic')
    er.code = 'EPERM'
    er.syscall = 'stat'
    return process.nextTick(cb.bind(null, er))
  }

  return stat.call(fs, path, cb)
}

fs.lstatSync = function (path) {
  // synthetically generate a non-ENOENT error
  if (badPaths.test(path)) {
    var er = new Error('synthetic')
    er.code = 'EPERM'
    er.syscall = 'lstat'
    throw er
  }

  return lstatSync.call(fs, path)
}

fs.statSync = function (path) {
  // synthetically generate a non-ENOENT error
  if (badPaths.test(path)) {
    var er = new Error('synthetic')
    er.code = 'EPERM'
    er.syscall = 'stat'
    throw er
  }

  return statSync.call(fs, path)
}

var glob = require('../')
var t = require('tap')

t.test('stat errors other than ENOENT are ok', function (t) {
  t.plan(2)
  t.test('async', async t => {
    const matches = await glob('a/*abc*/**', { stat: true, cwd: dir })
    t.same(matches, expect)
  })

  t.test('sync', async t => {
    const matches = glob.sync('a/*abc*/**', { stat: true, cwd: dir })
    t.same(matches, expect)
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
    expect = expect.filter(p => !p.includes('/symlink'))
  }

  var pattern = 'a/**'
  t.plan(2)
  t.test('async', async t => t.same(await glob(pattern, { cwd: dir }), expect))
  t.test('sync', async t => t.same(glob.sync(pattern, { cwd: dir }), expect))
})
