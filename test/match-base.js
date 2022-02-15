var t = require('tap')
var glob = require('../')
var path = require('path')
var fixtureDir = path.resolve(__dirname, 'fixtures')

var pattern = 'a*'
var expect = [
  'a',
  'a/abcdef',
  'a/abcfed',
]

if (process.platform !== 'win32')
  expect.push('a/symlink/a', 'a/symlink/a/b/c/a')

t.test('chdir', async t => {
  var origCwd = process.cwd()
  process.chdir(fixtureDir)
  t.same(glob.sync(pattern, { matchBase: true }), expect)
  t.same(await glob(pattern, { matchBase: true }), expect)
  process.chdir(origCwd)
})

t.test('cwd', async t => {
  t.same(glob.sync(pattern, { matchBase: true, cwd: fixtureDir }), expect)
  t.same(await glob(pattern, { matchBase: true, cwd: fixtureDir }), expect)
})

t.test('noglobstar', function (t) {
  t.throws(() => glob(pattern, { matchBase:true, noglobstar: true }))
  t.throws(() => glob.sync(pattern, { matchBase:true, noglobstar: true }))
  t.end()
})
