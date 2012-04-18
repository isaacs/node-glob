var tap = require("tap")

var origCwd = process.cwd()
process.chdir(__dirname)

tap.test("multiglob pattern for **/d", function (t) {
  var glob = require('../')
  var path = require('path')
  t.test('multiglob', function (t) {
    glob( 'a/b/*/d', 'a/c/**/d', function (er, matches) {
      t.ifError(er)
      t.like(matches, [ 'a/b/c/d', 'a/c/d' ])
      t.end()
    })
  })

  t.test('multiglob with inner brace set', function (t) {
    glob( '{/*,*}', 'a/b/*/d', 'a/c/**/d', function (er, matches) {
      t.ifError(er)
      t.ok(matches.length > 10, 'inner brace set results should be present')
      t.end()
    })
  })

  t.test('cd -', function (t) {
    process.chdir(origCwd)
    t.end()
  })

  t.end()
})
