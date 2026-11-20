import { assert, cleanup, test } from 'ubqtest'
import './00-setup.js'
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

test('chdir', async () => {
  const origCwd = process.cwd()
  process.chdir(fixtureDir)
  cleanup(() => process.chdir(origCwd))
  assert.deepEqual(
    glob.globSync(pattern, { matchBase: true }).sort(alphasort),
    j(expect),
  )
  assert.deepEqual(
    (await glob(pattern, { matchBase: true })).sort(alphasort),
    j(expect),
  )
})

test('cwd', async () => {
  assert.deepEqual(
    glob
      .globSync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    j(expect),
  )
  assert.deepEqual(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort,
    ),
    j(expect),
  )
})

test('noglobstar', async () => {
  await assert.rejects(
    glob(pattern, { matchBase: true, noglobstar: true }),
    Error,
  )
  assert.throws(
    () => glob.globSync(pattern, { matchBase: true, noglobstar: true }),
    Error,
  )
})

test('pattern includes /', async () => {
  const pattern = 'a/b*'
  const expect = ['a/b', 'a/bc']
  assert.deepEqual(
    glob
      .globSync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    j(expect),
  )
  assert.deepEqual(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort,
    ),
    j(expect),
  )
})

test('one brace section of pattern includes /', async () => {
  const pattern = 'a{*,/b*}'
  const exp = ['a', 'a/b', 'a/bc']
  assert.deepEqual(
    glob
      .globSync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    j(exp),
  )
  assert.deepEqual(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort,
    ),
    j(exp),
  )
})

test('one array member of pattern includes /', async () => {
  const pattern = ['a*', 'a/b*']
  const exp = expect.concat(['a/b', 'a/bc']).sort()
  assert.deepEqual(
    glob
      .globSync(pattern, { matchBase: true, cwd: fixtureDir })
      .sort(alphasort),
    j(exp),
  )
  assert.deepEqual(
    (await glob(pattern, { matchBase: true, cwd: fixtureDir })).sort(
      alphasort,
    ),
    j(exp),
  )
})
