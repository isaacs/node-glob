import { resolve } from 'path'
import t from 'tap'
import { glob } from '../'
import { sep } from 'path'
const j = (a: string[]) => a.map(s => s.split('/').join(sep))

const origCwd = process.cwd()
process.chdir(__dirname + '/fixtures')
t.teardown(() => process.chdir(origCwd))

t.test('changing cwd and searching for **/d', t => {
  const expect = Object.entries({
    a: new Set(j(['c/d', 'b/c/d'])),
    'a/b': new Set(j(['c/d'])),
    '': new Set(j(['a/b/c/d', 'a/c/d'])),
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
