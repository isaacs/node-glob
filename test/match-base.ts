import t from 'tap'
import glob from '../'

import { resolve } from 'path'

const fixtureDir = resolve(__dirname, 'fixtures')

const pattern = 'a*'
const expect = ['a', 'a/abcdef', 'a/abcfed']

if (process.platform !== 'win32') {
  expect.push('a/symlink/a', 'a/symlink/a/b/c/a')
}

const alphasort = (a: string, b: string) => a.localeCompare(b, 'en')

expect.sort(alphasort)

t.test('chdir', async t => {
  const origCwd = process.cwd()
  process.chdir(fixtureDir)
  t.teardown(() => process.chdir(origCwd))
  t.same(glob.sync(pattern, { matchBase: true }).sort(alphasort), expect)
  t.same(
    (await glob(pattern, { matchBase: true })).sort(alphasort),
    expect
  )
})

t.test('cwd', async t => {
  t.same(
    glob
      .sync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    expect
  )
  t.same(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort
    ),
    expect
  )
})

t.test('noglobstar', async t => {
  t.rejects(glob(pattern, { matchBase: true, noglobstar: true }))
  t.throws(() => glob.sync(pattern, { matchBase: true, noglobstar: true }))
  t.end()
})

t.test('pattern includes /', async t => {
  const pattern = 'a/b*'
  const expect = ['a/b', 'a/bc']
  t.same(
    glob
      .sync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    expect
  )
  t.same(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort
    ),
    expect
  )
})

t.test('one brace section of pattern includes /', async t => {
  const pattern = 'a{*,/b*}'
  const exp = ['a', 'a/b', 'a/bc']
  t.same(
    glob
      .sync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    exp
  )
  t.same(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort
    ),
    exp
  )
})

t.test('one array member of pattern includes /', async t => {
  const pattern = ['a*', 'a/b*']
  const exp = expect.concat(['a/b', 'a/bc']).sort()
  t.same(
    glob
      .sync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    exp
  )
  t.same(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort
    ),
    exp
  )
})
