var fs = require('fs')
var readdir = fs.readdir
var readdirSync = fs.readdirSync
var sawAsyncENOTSUP = false
var sawSyncENOTSUP = false

var path = require('path')
var fixtureDir = path.resolve(__dirname, 'fixtures')
var allowedDirs = [
  path.resolve(fixtureDir, 'a'),
  path.resolve(fixtureDir, 'a', 'abcdef'),
  path.resolve(fixtureDir, 'a', 'abcfed')
]

fs.readdirSync = function (p) {
  if (allowedDirs.indexOf(path.resolve(p)) === -1 &&
      !p.match(/[\\\/]node_modules[\\\/]/)) {
    sawSyncENOTSUP = true
    var er = new Error('ENOTSUP: Operation not supported')
    er.path = path
    er.code = 'ENOTSUP'
    throw er
  }
  return readdirSync.call(fs, p)
}

fs.readdir = function (p, cb) {
  if (allowedDirs.indexOf(path.resolve(p)) === -1 &&
      !p.match(/[\\\/]node_modules[\\\/]/)) {
    setTimeout(function () {
      sawAsyncENOTSUP = true
      er = new Error('ENOTSUP: Operation not supported')
      er.path = path
      er.code = 'ENOTSUP'
      return cb(er)
    })
  } else {
    readdir.call(fs, p, cb)
  }
}

var glob = require('../')
var test = require('tap').test
process.chdir(__dirname + '/fixtures')

var pattern = 'a/**/h'
var expect = [ 'a/abcdef/g/h', 'a/abcfed/g/h' ]

var options = { strict: true, silent: false }

test(pattern + ' ' + JSON.stringify(options), async t => {
  const resSync = glob.sync(pattern, options).sort()
  t.same(resSync, expect, 'sync results')
  t.ok(sawSyncENOTSUP, 'saw sync ENOTSUP')

  const g = new glob.Glob(pattern, options)
  const res = await g.results
  t.ok(sawAsyncENOTSUP, 'saw async ENOTSUP')
  t.same(res.sort(), expect, 'async results')
})
