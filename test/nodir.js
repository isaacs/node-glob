require("./global-leakage.js")
var test = require("tap").test
var glob = require('../')
process.chdir(__dirname)

test("nodir, with **", function (t) {
  glob("a/*b*/**", {nodir: true}, function (er, results) {
    if (er)
      throw er
    var expect =
      [ 'a/abcdef/g/h',
        'a/abcfed/g/h',
        'a/b/c/d',
        'a/bc/e/f',
        'a/cb/e/f' ]

    t.same(results, expect)
    t.end()
  })
})

test("nodir, with **/", function (t) {
  glob("a/*b*/**/", {nodir: true}, function (er, results) {
    if (er)
      throw er
    var expect = []

    t.same(results, expect)
    t.end()
  })
})

