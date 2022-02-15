require("./global-leakage.js")
var memfs = require('memfs')
var test = require('tap').test
var glob = require('../')

test('fs-compatible file system can be used', async t => {
  var volJson = {
    './text1.txt': 'abc',
    './javascript.js': 'abc',
    './text2.txt': 'abc',
  }
  var vol = memfs.Volume.fromJSON(volJson, '/some/directory')
  const f = await glob('*.txt', { cwd: '/some/directory', fs: vol })
  t.same(f, ['text1.txt', 'text2.txt'], 'matched txt files')
})

test('fs-compatible file system can be used with glob.sync', async t => {
  var volJson = {
    './text1.txt': 'abc',
    './javascript.js': 'abc',
    './text2.txt': 'abc',
  }
  var vol = memfs.Volume.fromJSON(volJson, '/some/directory')
  var f = glob.sync('*.txt', { cwd: '/some/directory', fs: vol })
  t.same(f, ['text1.txt', 'text2.txt'], 'matched txt files')
})
