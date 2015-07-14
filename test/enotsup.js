var fs = require('fs')
var readdir = fs.readdir
fs.readdir = function (path, cb) {
  fs.stat(path, function (er, stat) {
    if (er)
      return cb(er)
    if (!stat.isDirectory()) {
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

var pattern = 'a/**/h'
var expect = [ 'a/abcdef/g/h', 'a/abcfed/g/h' ]
var options = { strict: true }

test(pattern + ' ' + JSON.stringify(options), function (t) {
  var res = glob.sync(pattern, options).sort()
  t.same(res, expect, 'sync results')
  var g = glob(pattern, options, function (er, res) {
    if (er)
      throw er
    res = res.sort()
    t.same(res, expect, 'async results')
    t.end()
  })
})
