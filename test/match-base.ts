import t from 'tap'
import { glob } from '../dist/esm/index.js'
import { sep } from 'path'
import { fileURLToPath } from 'url'

const alphasort = (a: string, b: string) => a.localeCompare(b, 'en')
const j = (a: string[]) =>
  a.map(s => s.split('/').join(sep)).sort(alphasort)

const fixtureDir = fileURLToPath(new URL('./fixtures', import.meta.url))

const pattern = 'a*'
const expect = ['a', 'a/abcdef', 'a/abcfed']

if (process.platform !== 'win32') {
  expect.push('a/symlink/a', 'a/symlink/a/b/c/a')
}

t.test('chdir', async t => {
  const origCwd = process.cwd()
  process.chdir(fixtureDir)
  t.teardown(() => process.chdir(origCwd))
  t.same(
    glob.globSync(pattern, { matchBase: true }).sort(alphasort),
    j(expect)
  )
  t.same(
    (await glob(pattern, { matchBase: true })).sort(alphasort),
    j(expect)
  )
})

t.test('cwd', async t => {
  t.same(
    glob
      .globSync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    j(expect)
  )
  t.same(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort
    ),
    j(expect)
  )
})

t.test('noglobstar', async t => {
  t.rejects(glob(pattern, { matchBase: true, noglobstar: true }))
  t.throws(() =>
    glob.globSync(pattern, { matchBase: true, noglobstar: true })
  )
  t.end()
})

t.test('pattern includes /', async t => {
  const pattern = 'a/b*'
  const expect = ['a/b', 'a/bc']
  t.same(
    glob
      .globSync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    j(expect)
  )
  t.same(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort
    ),
    j(expect)
  )
})

t.test('one brace section of pattern includes /', async t => {
  const pattern = 'a{*,/b*}'
  const exp = ['a', 'a/b', 'a/bc']
  t.same(
    glob
      .globSync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    j(exp)
  )
  t.same(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort
    ),
    j(exp)
  )
})

t.test('one array member of pattern includes /', async t => {
  const pattern = ['a*', 'a/b*']
  const exp = expect.concat(['a/b', 'a/bc']).sort()
  t.same(
    glob
      .globSync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    j(exp)
  )
  t.same(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort
    ),
    j(exp)
  )
})
