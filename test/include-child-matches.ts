import t from 'tap'
import {
  glob,
  GlobOptionsWithFileTypesUnset,
  globSync,
} from '../src/index.js'

t.test('no include child matches', async t => {
  const cwd = t.testdir({ a: { b: { c: { d: { e: { f: '' } } } } } })
  const pattern = 'a/**/[cde]/**'
  const o: GlobOptionsWithFileTypesUnset = {
    cwd,
    posix: true,
    includeChildMatches: false,
  }
  const a = await glob(pattern, o)
  const s = globSync(pattern, o)
  t.strictSame(a, ['a/b/c'])
  t.strictSame(s, ['a/b/c'])
})

t.test('test the caveat', async t => {
  const cwd = t.testdir({ a: { b: { c: { d: { e: { f: '' } } } } } })
  const pattern = ['a/b/c/d/e/f', 'a/[bdf]/?/[a-z]/*']
  const o: GlobOptionsWithFileTypesUnset = {
    cwd,
    posix: true,
    includeChildMatches: false,
  }
  const a = await glob(pattern, o)
  const s = globSync(pattern, o)
  t.strictSame(a, ['a/b/c/d/e/f', 'a/b/c/d/e'])
  t.strictSame(s, ['a/b/c/d/e/f', 'a/b/c/d/e'])
})

t.test('ignore impl must have an add() method', t => {
  t.throws(() =>
    globSync('', {
      ignore: {
        ignored: () => true,
        childrenIgnored: () => true,
      },
      includeChildMatches: false,
    }),
  )
  t.end()
})
