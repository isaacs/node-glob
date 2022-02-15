require("./global-leakage.js")
var test = require("tap").test
var glob = require('../')
process.chdir(__dirname + '/fixtures')

// expose timing issues
var lag = 5
const doStat2 = glob.Glob.prototype.doStat2
glob.Glob.prototype.doStat2 = async function (...args) {
  return new Promise(res => {
    setTimeout(() => res(doStat2.call(this, ...args)), lag += 5)
  })
}

test('mark with cwd', async t => {
  var pattern = '*/*'
  var opt = { mark: true, cwd: 'a' }
  var expect = [
    'abcdef/g/',
    'abcfed/g/',
    'b/c/',
    'bc/e/',
    'c/d/',
    'cb/e/',
  ].sort()
  if (process.platform !== 'win32')
    expect.push('symlink/a/')

  t.same(glob.sync(pattern, opt).sort(), expect, 'sync results')
  t.same((await glob(pattern, opt)).sort(), expect, 'async results')
})

test("mark, with **", async t => {
  var pattern = 'a/*b*/**'
  var opt = { mark: true }
  const results = await glob(pattern, opt)
  var expect =
    [ 'a/abcdef/',
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
      'a/cb/e/f' ]

  t.same(results, expect)
  t.same(glob.sync(pattern, opt), expect)
})

test("mark, no / on pattern", async t => {
  var pattern = 'a/*'
  var opt = { mark: true }
  const g = new glob.Glob(pattern, opt)
  var expect = [ 'a/abcdef/',
                 'a/abcfed/',
                 'a/b/',
                 'a/bc/',
                 'a/c/',
                 'a/cb/',
                 'a/x/',
                 'a/z/' ]

  if (process.platform !== "win32")
    expect.push('a/symlink/')

  expect = expect.sort()
  g.on('match', m => t.match(m, /\/$/))
  g.resume()
  t.same(await g.results, expect)
  t.same(glob.sync(pattern, opt), expect)
})

test("mark=false, no / on pattern", async t => {
  var pattern = 'a/*'
  const g = new glob.Glob(pattern)
  var expect = [ 'a/abcdef',
                 'a/abcfed',
                 'a/b',
                 'a/bc',
                 'a/c',
                 'a/cb',
                 'a/x',
                 'a/z' ]

  if (process.platform !== "win32")
    expect.push('a/symlink')

  g.on('match', m => t.match(m, /[^\/]$/))
  expect = expect.sort()

  t.same(await g.results, expect)
  t.same(glob.sync(pattern), expect)
  t.end()
})

test("mark=true, / on pattern", async t => {
  var pattern = 'a/*/'
  var opt = { mark: true }
  const g = new glob.Glob(pattern, opt)
  var expect = [ 'a/abcdef/',
                  'a/abcfed/',
                  'a/b/',
                  'a/bc/',
                  'a/c/',
                  'a/cb/',
                  'a/x/',
                  'a/z/' ]

  if (process.platform !== "win32")
    expect.push('a/symlink/')

  expect = expect.sort()

  g.on('match', m => t.match(m, /\/$/))
  t.same(await g.results, expect)
  t.same(glob.sync(pattern, opt), expect)
})

test("mark=false, / on pattern", async t => {
  var pattern = "a/*/"
  const g = new glob.Glob(pattern)
  var expect = [ 'a/abcdef/',
                 'a/abcfed/',
                 'a/b/',
                 'a/bc/',
                 'a/c/',
                 'a/cb/',
                 'a/x/',
                 'a/z/' ]
  if (process.platform !== "win32")
    expect.push('a/symlink/')

  expect = expect.sort()

  g.on('match', m => t.match(m, /\/$/))
  t.same(await g.results, expect)
  t.same(glob.sync(pattern), expect)
})

var cwd = process.cwd().replace(/[\/\\]+$/, '').replace(/\\/g, '/')
;[true,false].forEach(mark => {
  ;[true,false].forEach(slash => {
    test("cwd mark:" + mark + " slash:" + slash, async t => {
      var pattern = cwd + (slash ? '/' : '')
      const results = await glob(pattern, {mark:mark})
      t.equal(results.length, 1)
      var res = results[0].replace(/\\/g, '/')
      var syncRes = glob.sync(pattern, {mark:mark})
      syncRes = syncRes[0].replace(/\\/g, '/')
      if (slash || mark)
        t.equal(res, cwd + '/')
      else
        t.equal(res.indexOf(cwd), 0)
      t.equal(syncRes, res, 'sync should match async')
    })
  })
})
