import { assert, test, testdir } from 'ubqtest'
import type { GlobOptionsWithFileTypesUnset } from '../src/index.js'
import { glob, globSync } from '../src/index.js'

test('no include child matches', async () => {
  const cwd = testdir({ a: { b: { c: { d: { e: { f: '' } } } } } })
  const pattern = 'a/**/[cde]/**'
  const o: GlobOptionsWithFileTypesUnset = {
    cwd,
    posix: true,
    includeChildMatches: false,
  }
  const a = await glob(pattern, o)
  const s = globSync(pattern, o)
  assert.deepEqual(a, ['a/b/c'])
  assert.deepEqual(s, ['a/b/c'])
})

test('test the caveat', async () => {
  const cwd = testdir({ a: { b: { c: { d: { e: { f: '' } } } } } })
  const pattern = ['a/b/c/d/e/f', 'a/[bdf]/?/[a-z]/*']
  const o: GlobOptionsWithFileTypesUnset = {
    cwd,
    posix: true,
    includeChildMatches: false,
  }
  const a = await glob(pattern, o)
  const s = globSync(pattern, o)
  assert.deepEqual(a, ['a/b/c/d/e/f', 'a/b/c/d/e'])
  assert.deepEqual(s, ['a/b/c/d/e/f', 'a/b/c/d/e'])
})

test('ignore impl must have an add() method', () => {
  assert.throws(
    () =>
      globSync('', {
        ignore: {
          ignored: () => true,
          childrenIgnored: () => true,
        },
        includeChildMatches: false,
      }),
    Error,
  )
})
