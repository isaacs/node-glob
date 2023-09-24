// test that escape chars are handled properly according to configs
// when found in patterns and paths containing glob magic.

import t from 'tap'
import { glob } from '../dist/esm/index.js'

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

t.test('treat backslash as escape', t => {
  const cases = Object.entries({
    'a[x]b/y': [],
    'a\\[x\\]b/y': ['a[x]b/y'],
    'a\\[x\\]b\\y': ['a[x]by'],
  })
  t.plan(cases.length)
  for (const [pattern, expect] of cases) {
    t.test(pattern, async t => {
      t.strictSame(
        glob.globSync(pattern, { cwd: dir, posix: true }),
        expect,
        'sync'
      )
      t.strictSame(
        (await glob(pattern, { cwd: dir })).map(s =>
          s.replace(/\\/g, '/')
        ),
        expect,
        'async'
      )
    })
  }
})

t.test('treat backslash as separator', t => {
  Object.defineProperty(process, 'platform', {
    value: 'win32',
  })
  const cases = Object.entries({
    'a[x]b/y': [],
    'a\\[x\\]b/y': ['a/[x/]b/y'],
    'a\\[x\\]b\\y': ['a/[x/]b/y'],
  })
  t.plan(cases.length)
  for (const [pattern, expect] of cases) {
    t.test(pattern, async t => {
      t.strictSame(
        glob
          .globSync(pattern, { cwd: dir, windowsPathsNoEscape: true })
          .map(s => s.replace(/\\/g, '/')),
        expect,
        'sync'
      )
      t.strictSame(
        (
          await glob(pattern, { cwd: dir, windowsPathsNoEscape: true })
        ).map(s => s.replace(/\\/g, '/')),
        expect,
        'async'
      )
    })
  }
})
