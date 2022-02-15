const t = require('tap')
const glob = require('../')

if (process.platform === 'win32')
  return require('tap').plan(0, 'skip on windows')

const dir = t.testdir({
  a: {
    'broken-link': {
      link: t.fixture('symlink', 'this-does-not-exist'),
    },
  },
})

var link = dir + '/a/broken-link/link'

var patterns = [
  dir + '/a/broken-link/*',
  dir + '/a/broken-link/**',
  dir + '/a/broken-link/**/link',
  dir + '/a/broken-link/**/*',
  dir + '/a/broken-link/link',
  dir + '/a/broken-link/{link,asdf}',
  dir + '/a/broken-link/+(link|asdf)',
  dir + '/a/broken-link/!(asdf)'
]

var opts = [
  undefined,
  { nonull: true },
  { mark: true },
  { stat: true },
  { follow: true }
]

t.test('async test', async t => {
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

t.test('sync test', function (t) {
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
