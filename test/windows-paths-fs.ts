// test that escape chars are handled properly according to configs
// when found in patterns and paths containing glob magic.

import { assert, describe, stub, test, testdir } from 'ubqtest'
import { glob } from '../dist/esm/index.js'

const dir = testdir({
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

describe('treat backslash as escape', () => {
  const cases = Object.entries({
    'a[x]b/y': [],
    'a\\[x\\]b/y': ['a[x]b/y'],
    'a\\[x\\]b\\y': ['a[x]by'],
  })
  for (const [pattern, expect] of cases) {
    test(pattern, async () => {
      assert.deepEqual(
        glob.globSync(pattern, { cwd: dir, posix: true }),
        expect,
        'sync',
      )
      assert.deepEqual(
        (await glob(pattern, { cwd: dir })).map(s =>
          s.replace(/\\/g, '/'),
        ),
        expect,
        'async',
      )
    })
  }
})

describe('treat backslash as separator', () => {
  const cases = Object.entries({
    'a[x]b/y': [],
    'a\\[x\\]b/y': ['a/[x/]b/y'],
    'a\\[x\\]b\\y': ['a/[x/]b/y'],
  })
  for (const [pattern, expect] of cases) {
    test(pattern, async () => {
      stub(process, 'platform', 'win32')
      assert.deepEqual(
        glob
          .globSync(pattern, { cwd: dir, windowsPathsNoEscape: true })
          .map(s => s.replace(/\\/g, '/')),
        expect,
        'sync',
      )
      assert.deepEqual(
        (
          await glob(pattern, { cwd: dir, windowsPathsNoEscape: true })
        ).map(s => s.replace(/\\/g, '/')),
        expect,
        'async',
      )
    })
  }
})
