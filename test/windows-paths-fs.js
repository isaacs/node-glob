// test that escape chars are handled properly according to configs
// when found in patterns and paths containing glob magic.

const t = require('tap')
const dir = t.testdir({
  // treat escapes as path separators
  a: {
    '[x': {
      ']b': {
        y: '',
      },
    },
  },
  // escape parent dir name only, not filename
  'a[x]b': {
    y: '',
  },
  // no path separators, all escaped
  'a[x]by': '',
})

const glob = require('../')
t.test('treat backslash as escape', async t => {
  const cases = {
    'a[x]b/y': [],
    'a\\[x\\]b/y': ['a[x]b/y'],
    'a\\[x\\]b\\y': ['a[x]by'],
  }
  for (const [pattern, expect] of Object.entries(cases)) {
    t.test(pattern, t => {
      const s = glob.sync(pattern, { cwd: dir })
        .map(s => s.replace(/\\/g, '/'))
      t.strictSame(s, expect, 'sync')
      glob(pattern, {cwd: dir}, (er, s) => {
        if (er) {
          throw er
        }
        s = s.map(s => s.replace(/\\/g, '/'))
        t.strictSame(s, expect, 'async')
        t.end()
      })
    })
  }
})

t.test('treat backslash as separator', async t => {
  Object.defineProperty(process, 'platform', {
    value: 'win32'
  })
  const cases = {
    'a[x]b/y': [],
    'a\\[x\\]b/y': ['a/[x/]b/y'],
    'a\\[x\\]b\\y': ['a/[x/]b/y'],
  }
  for (const [pattern, expect] of Object.entries(cases)) {
    t.test(pattern, t => {
      const s = glob.sync(pattern, { cwd: dir, windowsPathsNoEscape: true })
        .map(s => s.replace(/\\/g, '/'))
      t.strictSame(s, expect, 'sync')
      glob(pattern, {cwd: dir, windowsPathsNoEscape: true}, (er, s) => {
        if (er) {
          throw er
        }
        s = s.map(s => s.replace(/\\/g, '/'))
        t.strictSame(s, expect, 'async')
        t.end()
      })
    })
  }
})
