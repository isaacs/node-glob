import { sep } from 'path'
import { assert, test } from 'ubqtest'
import './00-setup.js'
import { fileURLToPath } from 'url'
import { glob } from '../dist/esm/index.js'

process.chdir(fileURLToPath(new URL('./fixtures', import.meta.url)))

const alphasort = (a: string, b: string) => a.localeCompare(b, 'en')
const j = (a: string[]) =>
  a.map(s => s.split('/').join(sep)).sort(alphasort)

test('mark with cwd', async () => {
  const pattern = '*/*'
  const opt = { mark: true, cwd: 'a' }
  const expect = [
    'abcdef/g/',
    'abcfed/g/',
    'b/c/',
    'bc/e/',
    'c/d/',
    'cb/e/',
  ]

  const res = await glob(pattern, opt)
  if (process.platform !== 'win32') {
    expect.push('symlink/a/')
  }

  assert.deepEqual(res.sort(alphasort), j(expect))
  assert.deepEqual(glob.globSync(pattern, opt).sort(alphasort), j(expect))
})

test('mark, with **', async () => {
  const pattern = 'a/*b*/**'
  const opt = { mark: true }
  const expect = [
    'a/abcdef/',
    'a/abcdef/g/',
    'a/abcdef/g/h',
    'a/abcfed/',
    'a/abcfed/g/',
    'a/abcfed/g/h',
    'a/b/',
    'a/b/c/',
    'a/b/c/d',
    'a/bc/',
    'a/bc/e/',
    'a/bc/e/f',
    'a/cb/',
    'a/cb/e/',
    'a/cb/e/f',
  ].sort(alphasort)

  assert.deepEqual(
    (await glob(pattern, opt)).sort(alphasort),
    j(expect),
    'async',
  )
  assert.deepEqual(
    glob.globSync(pattern, opt).sort(alphasort),
    j(expect),
    'sync',
  )
})

test('mark, no / on pattern', async () => {
  const pattern = 'a/*'
  const opt = { mark: true }
  const expect = [
    'a/abcdef/',
    'a/abcfed/',
    'a/b/',
    'a/bc/',
    'a/c/',
    'a/cb/',
    'a/x/',
    'a/z/',
  ]
  if (process.platform !== 'win32') {
    expect.push('a/symlink/')
  }
  const results = (await glob(pattern, opt)).sort(alphasort)
  assert.deepEqual(results, j(expect))
  assert.deepEqual(glob.globSync(pattern, opt).sort(alphasort), j(expect))
})

test('mark=false, no / on pattern', async () => {
  const pattern = 'a/*'
  const expect = [
    'a/abcdef',
    'a/abcfed',
    'a/b',
    'a/bc',
    'a/c',
    'a/cb',
    'a/x',
    'a/z',
  ]
  if (process.platform !== 'win32') {
    expect.push('a/symlink')
  }
  const results = (await glob(pattern)).sort(alphasort)

  assert.deepEqual(results, j(expect))
  assert.deepEqual(glob.globSync(pattern).sort(alphasort), j(expect))
})

test('mark=true, / on pattern', async () => {
  const pattern = 'a/*/'
  const opt = { mark: true }
  const expect = [
    'a/abcdef/',
    'a/abcfed/',
    'a/b/',
    'a/bc/',
    'a/c/',
    'a/cb/',
    'a/x/',
    'a/z/',
  ]

  if (process.platform !== 'win32') {
    expect.push('a/symlink/')
  }
  const results = (await glob(pattern, opt)).sort(alphasort)
  assert.deepEqual(results, j(expect))
  assert.deepEqual(glob.globSync(pattern, opt).sort(alphasort), j(expect))
})

test('mark=false, / on pattern', async () => {
  const pattern = 'a/*/'
  const expect = [
    'a/abcdef',
    'a/abcfed',
    'a/b',
    'a/bc',
    'a/c',
    'a/cb',
    'a/x',
    'a/z',
  ]
  if (process.platform !== 'win32') {
    expect.push('a/symlink')
  }

  const results = (await glob(pattern)).sort(alphasort)
  assert.deepEqual(results, j(expect))
  assert.deepEqual(glob.globSync(pattern).sort(alphasort), j(expect))
})

const cwd = process
  .cwd()
  .replace(/[/\\]+$/, '')
  .replace(/\\/g, '/')
for (const mark of [true, false]) {
  for (const slash of [true, false]) {
    test(`cwd mark:${mark} slash:${slash}`, async () => {
      const pattern = cwd + (slash ? '/' : '')
      const results = await glob(pattern, { mark })
      assert.equal(results.length, 1)
      const res = results[0]?.replace(/\\/g, '/')
      const syncResults = glob.globSync(pattern, { mark: mark })
      const syncRes = syncResults[0]?.replace(/\\/g, '/')
      if (mark) {
        assert.equal(res, `${cwd}/`)
      } else {
        assert.equal(res?.indexOf(cwd), 0)
      }
      assert.equal(syncRes, res, 'sync should match async')
    })
  }
}

for (const mark of [true, false]) {
  for (const slash of [true, false]) {
    test(`. mark:${mark} slash:${slash}`, async () => {
      const pattern = `.${slash ? '/' : ''}`
      const results = await glob(pattern, { mark })
      assert.equal(results.length, 1)
      const res = results[0]?.replace(/\\/g, '/')
      const syncResults = glob.globSync(pattern, { mark: mark })
      const syncRes = syncResults[0]?.replace(/\\/g, '/')
      if (mark) {
        assert.equal(res, './')
      } else {
        assert.equal(res, '.')
      }
      assert.equal(syncRes, res, 'sync should match async')
    })
  }
}
