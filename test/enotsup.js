var fs = require('fs')
var readdir = fs.readdir
var readdirSync = fs.readdirSync
var sawAsyncENOTSUP = false
var sawSyncENOTSUP = false

fs.readdirSync = function (path) {
  var stat = fs.statSync(path)
  if (!stat.isDirectory()) {
    sawSyncENOTSUP = true
    var er = new Error('ENOTSUP: Operation not supported')
    er.path = path
    er.code = 'ENOTSUP'
    throw er
  }
  return readdirSync.call(fs, path)
}

fs.readdir = function (path, cb) {
  fs.stat(path, function (er, stat) {
    if (er)
      return cb(er)
    if (!stat.isDirectory()) {
      sawAsyncENOTSUP = true
      er = new Error('ENOTSUP: Operation not supported')
      er.path = path
      er.code = 'ENOTSUP'
      return cb(er)
    }
    return readdir.call(fs, path, cb)
  })
}

var glob = require('../')
var test = require('tap').test
var common = require('../common.js')
process.chdir(__dirname + '/fixtures')

var pattern = 'a/**/{h,a}/**'
var expect = [ 'a/abcdef/g/h', 'a/abcfed/g/h' ]
var expect = [
  'a/symlink/a',
  'a/symlink/a/b',
  'a/symlink/a/b/c',
  'a/symlink/a/b/c/a',
  'a/symlink/a/b/c/a/b',
  'a/symlink/a/b/c/a/b/c'
]

var options = { strict: true, silent: false }

test(pattern + ' ' + JSON.stringify(options), function (t) {
  var res = glob.sync(pattern, options).sort()
  t.same(res, expect, 'sync results')
  t.ok(sawSyncENOTSUP, 'saw sync ENOTSUP')

  var g = glob(pattern, options, function (er, res) {
    if (er)
      throw er
    t.ok(sawAsyncENOTSUP, 'saw async ENOTSUP')
    res = res.sort()
    t.same(res, expect, 'async results')
    t.end()
  })
})
