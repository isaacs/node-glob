require("./global-leakage.js")
var test = require("tap").test
var glob = require('../')
process.chdir(__dirname)

test("mark, with **", function (t) {
  var results = glob.sync("a/*b*/**", {mark: true})
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
  t.end()
})

test("mark, no / on pattern", function (t) {
  var results = glob.sync("a/*", {mark: true})
  var expect = [ 'a/abcdef/',
                 'a/abcfed/',
                 'a/b/',
                 'a/bc/',
                 'a/c/',
                 'a/cb/' ]

  if (process.platform !== "win32")
    expect.push('a/symlink/')

  t.same(results, expect)
  t.end()
})

test("mark=false, no / on pattern", function (t) {
  var results = glob.sync("a/*")
  var expect = [ 'a/abcdef',
                 'a/abcfed',
                 'a/b',
                 'a/bc',
                 'a/c',
                 'a/cb' ]

  if (process.platform !== "win32")
    expect.push('a/symlink')
  t.same(results, expect)
  t.end()
})

test("mark=true, / on pattern", function (t) {
  var results = glob.sync("a/*/", {mark: true})
  var expect = [ 'a/abcdef/',
                  'a/abcfed/',
                  'a/b/',
                  'a/bc/',
                  'a/c/',
                  'a/cb/' ]
  if (process.platform !== "win32")
    expect.push('a/symlink/')
  t.same(results, expect)
  t.end()
})

test("mark=false, / on pattern", function (t) {
  var results = glob.sync("a/*/")
  var expect = [ 'a/abcdef/',
                 'a/abcfed/',
                 'a/b/',
                 'a/bc/',
                 'a/c/',
                 'a/cb/' ]
  if (process.platform !== "win32")
    expect.push('a/symlink/')
  t.same(results, expect)
  t.end()
})

var cwd = process.cwd().replace(/[\/\\]+$/, '').replace(/\\/g, '/')
;[true,false].forEach(function (mark) {
  ;[true,false].forEach(function (slash) {
    test("cwd mark:" + mark + " slash:" + slash, function (t) {
      var pattern = cwd + (slash ? '/' : '')
      var results = glob.sync(pattern, {mark:mark})
      t.equal(results.length, 1)
      var res = results[0].replace(/\\/g, '/')
      if (slash || mark)
        t.equal(res, cwd + '/')
      else
        t.equal(res.indexOf(cwd), 0)
      t.end()
    })
  })
})
