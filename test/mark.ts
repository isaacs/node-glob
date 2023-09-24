import { sep } from 'path'
import t from 'tap'
import { fileURLToPath } from 'url'
import { glob } from '../dist/esm/index.js'

process.chdir(fileURLToPath(new URL('./fixtures', import.meta.url)))

const alphasort = (a: string, b: string) => a.localeCompare(b, 'en')
const j = (a: string[]) =>
  a.map(s => s.split('/').join(sep)).sort(alphasort)

t.test('mark with cwd', async t => {
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

  t.same(res.sort(alphasort), j(expect))
  t.same(glob.globSync(pattern, opt).sort(alphasort), j(expect))
})

t.test('mark, with **', async t => {
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

  t.same((await glob(pattern, opt)).sort(alphasort), j(expect), 'async')
  t.same(glob.globSync(pattern, opt).sort(alphasort), j(expect), 'sync')
})

t.test('mark, no / on pattern', async t => {
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
  t.same(results, j(expect))
  t.same(glob.globSync(pattern, opt).sort(alphasort), j(expect))
})

t.test('mark=false, no / on pattern', async t => {
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

  t.same(results, j(expect))
  t.same(glob.globSync(pattern).sort(alphasort), j(expect))
})

t.test('mark=true, / on pattern', async t => {
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
  t.same(results, j(expect))
  t.same(glob.globSync(pattern, opt).sort(alphasort), j(expect))
})

t.test('mark=false, / on pattern', async t => {
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
  t.same(results, j(expect))
  t.same(glob.globSync(pattern).sort(alphasort), j(expect))
})

const cwd = process
  .cwd()
  .replace(/[\/\\]+$/, '')
  .replace(/\\/g, '/')
for (const mark of [true, false]) {
  for (const slash of [true, false]) {
    t.test('cwd mark:' + mark + ' slash:' + slash, async t => {
      const pattern = cwd + (slash ? '/' : '')
      const results = await glob(pattern, { mark })
      t.equal(results.length, 1)
      const res = results[0]?.replace(/\\/g, '/')
      const syncResults = glob.globSync(pattern, { mark: mark })
      const syncRes = syncResults[0]?.replace(/\\/g, '/')
      if (mark) {
        t.equal(res, cwd + '/')
      } else {
        t.equal(res?.indexOf(cwd), 0)
      }
      t.equal(syncRes, res, 'sync should match async')
    })
  }
}

for (const mark of [true, false]) {
  for (const slash of [true, false]) {
    t.test('. mark:' + mark + ' slash:' + slash, async t => {
      const pattern = '.' + (slash ? '/' : '')
      const results = await glob(pattern, { mark })
      t.equal(results.length, 1)
      const res = results[0]?.replace(/\\/g, '/')
      const syncResults = glob.globSync(pattern, { mark: mark })
      const syncRes = syncResults[0]?.replace(/\\/g, '/')
      if (mark) {
        t.equal(res, './')
      } else {
        t.equal(res, '.')
      }
      t.equal(syncRes, res, 'sync should match async')
    })
  }
}
