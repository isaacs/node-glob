var fs = require('fs')
var test = require('tap').test
var glob = require('../')
var mkdirp = require('mkdirp')

if (process.platform === 'win32')
  return require('tap').plan(0, 'skip on windows')

process.chdir(__dirname)

var link = 'fixtures/a/broken-link/link'

var patterns = [
  'fixtures/a/broken-link/*',
  'fixtures/a/broken-link/**',
  'fixtures/a/broken-link/**/link',
  'fixtures/a/broken-link/**/*',
  'fixtures/a/broken-link/link',
  'fixtures/a/broken-link/{link,asdf}',
  'fixtures/a/broken-link/+(link|asdf)',
  'fixtures/a/broken-link/!(asdf)'
]

var opts = [
  undefined,
  { nonull: true },
  { mark: true },
  { stat: true },
  { follow: true }
]

test('set up broken symlink', function (t) {
  cleanup()
  mkdirp.sync('fixtures/a/broken-link')
  fs.symlinkSync('this-does-not-exist', 'fixtures/a/broken-link/link')
  t.end()
})

test('async test', async t => {
  const count = patterns.length * opts.length
  t.plan(patterns.length)
  const check = res => async t => {
    t.equal(res.includes(link), true, { haystack: res, needle: link })
  }
  for (const pattern of patterns) {
    t.test(pattern, async t => {
      t.plan(opts.length)
      for (const opt of opts) {
        t.test(JSON.stringify(opt), check(await glob(pattern, opt)))
      }
    })
  }
})

test('sync test', function (t) {
  const count = patterns.length * opts.length
  t.plan(patterns.length)
  const check = res => async t => {
    t.equal(res.includes(link), true, { haystack: res, needle: link })
  }
  for (const pattern of patterns) {
    t.test(pattern, async t => {
      t.plan(opts.length)
      for (const opt of opts) {
        t.test(JSON.stringify(opt), check(glob.sync(pattern, opt)))
      }
    })
  }
})

test('cleanup', function (t) {
  cleanup()
  t.end()
})

function cleanup () {
  try { fs.unlinkSync('fixtures/a/broken-link/link') } catch (e) {}
  try { fs.rmdirSync('fixtures/a/broken-link') } catch (e) {}
}
