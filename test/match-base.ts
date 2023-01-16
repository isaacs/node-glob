import t from 'tap'
import glob from '../'

import { resolve } from 'path'

const fixtureDir = resolve(__dirname, 'fixtures')

const pattern = 'a*'
const expect = ['a', 'a/abcdef', 'a/abcfed']

if (process.platform !== 'win32') {
  expect.push('a/symlink/a', 'a/symlink/a/b/c/a')
}

t.test('chdir', async t => {
  const origCwd = process.cwd()
  process.chdir(fixtureDir)
  t.same(glob.sync(pattern, { matchBase: true }), expect)
  t.same(await glob(pattern, { matchBase: true }), expect)
  process.chdir(origCwd)
})

t.test('cwd', async t => {
  t.same(glob.sync(pattern, { matchBase: true, cwd: fixtureDir }), expect)
  t.same(await glob(pattern, { matchBase: true, cwd: fixtureDir }), expect)
})

t.test('noglobstar', async t => {
  t.rejects(glob(pattern, { matchBase: true, noglobstar: true }))
  t.throws(() => glob.sync(pattern, { matchBase: true, noglobstar: true }))
  t.end()
})
