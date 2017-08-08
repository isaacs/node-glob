require('./global-leakage.js')
// remove the fixtures
var tap = require('tap')
var rimraf = require('rimraf')
var path = require('path')

tap.test('cleanup fixtures', function (t) {
  rimraf(path.resolve(__dirname, 'fixtures'), function (er) {
    t.ifError(er, 'removed')
    t.end()
  })
})
