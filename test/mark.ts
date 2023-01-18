import t from 'tap'
import glob from '../'
process.chdir(__dirname + '/fixtures')

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
  ].sort()

  const res = await glob(pattern, opt)
  if (process.platform !== 'win32') {
    expect.push('symlink/a/')
  }

  t.same(res.sort(), expect)
  t.same(glob.sync(pattern, opt).sort(), expect)
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
  ]

  t.same(await glob(pattern, opt), expect, 'async')
  t.same(glob.sync(pattern, opt), expect, 'sync')
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
  expect.sort()
  const results = await glob(pattern, opt)
  t.same(results, expect)
  t.same(glob.sync(pattern, opt), expect)
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
  expect.sort()
  const results = await glob(pattern)

  t.same(results, expect)
  t.same(glob.sync(pattern), expect)
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
  expect.sort()
  const results = await glob(pattern, opt)
  t.same(results, expect)
  t.same(glob.sync(pattern, opt), expect)
})

t.test('mark=false, / on pattern', async t => {
  const pattern = 'a/*/'
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
  expect.sort()

  const results = await glob(pattern)
  t.same(results, expect)
  t.same(glob.sync(pattern), expect)
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
      const res = results[0].replace(/\\/g, '/')
      const syncResults = glob.sync(pattern, { mark: mark })
      const syncRes = syncResults[0].replace(/\\/g, '/')
      if (slash || mark) {
        t.equal(res, cwd + '/')
      } else {
        t.equal(res.indexOf(cwd), 0)
      }
      t.equal(syncRes, res, 'sync should match async')
    })
  }
}
