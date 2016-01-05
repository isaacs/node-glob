require("./global-leakage.js")
var test = require('tap').test
var g = require('../')
test('sync throws if provided callback', function (t) {
  t.throws(function () {
    g('*', {sync:true}, function() {})
  })
  t.throws(function () {
    g.sync('*', function() {})
  })
  t.throws(function () {
    g.sync('*', {}, function() {})
  })

  t.throws(function () {
    g.Glob('*', {sync:true}, function() {})
  })

  t.throws(function () {
    g.GlobSync('*', {}, function() {})
  })

  t.throws(function () {
    g.GlobSync('*', function() {})
  })

  t.throws(function () {
    g.GlobSync()
  })

  t.throws(function () {
    g.sync()
  })

  t.throws(function () {
    g()
  })

  t.throws(function () {
    g.Glob()
  })

  t.end()
})


