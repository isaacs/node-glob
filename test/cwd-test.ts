import { resolve } from 'path'
import t from 'tap'
import { glob } from '../'

const origCwd = process.cwd()
process.chdir(__dirname + '/fixtures')
t.teardown(() => process.chdir(origCwd))

t.test('changing cwd and searching for **/d', t => {
  const expect = Object.entries({
    a: new Set(['c/d', 'b/c/d']),
    'a/b': new Set(['c/d']),
    '': new Set(['a/b/c/d', 'a/c/d']),
  })
  t.plan(expect.length)
  for (const [cwd, matches] of expect) {
    t.test(cwd || '(empty string)', async t => {
      t.same(new Set(await glob('**/d', { cwd })), matches)
      if (cwd) {
        t.same(new Set(await glob('**/d', { cwd: cwd + '/' })), matches)
        t.same(new Set(await glob('**/d', { cwd: cwd + '/.' })), matches)
        t.same(new Set(await glob('**/d', { cwd: cwd + '/./' })), matches)
      } else {
        t.same(new Set(await glob('**/d', { cwd: '.' })), matches)
        t.same(new Set(await glob('**/d', { cwd: './' })), matches)
      }
      t.same(new Set(await glob('**/d', { cwd: resolve(cwd) })), matches)
      t.same(
        new Set(await glob('**/d', { cwd: resolve(cwd) + '/' })),
        matches
      )
      t.same(
        new Set(await glob('**/d', { cwd: resolve(cwd) + '/.' })),
        matches
      )
      t.same(
        new Set(await glob('**/d', { cwd: resolve(cwd) + '/./' })),
        matches
      )
    })
  }
})
