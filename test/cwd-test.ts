import { join, resolve } from 'path'
import t from 'tap'
import glob from '../'

const origCwd = process.cwd()
process.chdir(__dirname + '/fixtures')
t.teardown(() => process.chdir(origCwd))

t.test('changing cwd and searching for **/d', t => {
  const expect = Object.entries({
    a: ['b/c/d', 'c/d'],
    'a/b': ['c/d'],
    '': ['a/b/c/d', 'a/c/d'],
  })
  t.plan(expect.length)
  for (const [cwd, matches] of expect) {
    t.test(cwd || '(empty string)', async t => {
      t.same(await glob('**/d', { cwd }), matches)
      if (cwd) {
        t.same(await glob('**/d', { cwd: cwd + '/' }), matches)
        t.same(await glob('**/d', { cwd: cwd + '/.' }), matches)
        t.same(await glob('**/d', { cwd: cwd + '/./' }), matches)
      } else {
        t.same(await glob('**/d', { cwd: '.' }), matches)
        t.same(await glob('**/d', { cwd: './' }), matches)
      }
      t.same(await glob('**/d', { cwd: resolve(cwd) }), matches)
      t.same(await glob('**/d', { cwd: resolve(cwd) + '/' }), matches)
      t.same(await glob('**/d', { cwd: resolve(cwd) + '/.' }), matches)
      t.same(await glob('**/d', { cwd: resolve(cwd) + '/./' }), matches)
    })
  }
})
