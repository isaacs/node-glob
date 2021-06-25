require("./global-leakage.js")
var memfs = require('memfs')
var test = require('tap').test
var glob = require("../glob.js")

test('fs-compatible file system can be used', function (t) {
  var volJson = {
    './text1.txt': 'abc',
    './javascript.js': 'abc',
    './text2.txt': 'abc',
  }
  var vol = memfs.Volume.fromJSON(volJson, '/some/directory')
  glob('*.txt', { cwd: '/some/directory', fs: vol }, function (e, f) {
    t.equal(e, null, 'no error')
    t.same(f, ['text1.txt', 'text2.txt'], 'matched txt files')
    t.end()
  })
})

test('fs-compatible file system can be used with glob.sync', function (t) {
  var volJson = {
    './text1.txt': 'abc',
    './javascript.js': 'abc',
    './text2.txt': 'abc',
  }
  var vol = memfs.Volume.fromJSON(volJson, '/some/directory')
  var f = glob.sync('*.txt', { cwd: '/some/directory', fs: vol })
  t.same(f, ['text1.txt', 'text2.txt'], 'matched txt files')
  t.end()
})
