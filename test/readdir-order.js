// Make sure that we get consistent results, even if fs.readdir
// returns entries in a different order.
require("./global-leakage.js")
var Glob = require("../glob.js").Glob
var test = require('tap').test
var fs = require('fs')

var matches = []

test('get globstar matches', function(t) {
  var pattern = 'a/**/[gh]'
  var g = new Glob(pattern, { cwd: __dirname })
  g.on('match', function(m) {
    matches.push(m)
  })
  g.on('end', function(set) {
    var sortedMatches = matches.slice(0).sort()
    set = set.sort()
    t.same(sortedMatches, set, 'should have same set of matches')
    t.end()
  })
})

test('shuffle fs.readdir', function (t) {
  // Not an ideal shuffle, but ok enough for this purpose
  function shuffle(entries) {
    return entries.sort(rand)
  }
  function rand(a, b) {
    return Math.random() - 0.5
  }

  fs.readdir = function (orig) { return function (path, cb) {
    orig(path, function (er, entries) {
      if (entries)
        shuffle(entries)
      cb(er, entries)
    })
  }}(fs.readdir)

  fs.readdirSync = function (orig) { return function (path) {
    return shuffle(orig(path))
  }}(fs.readdirSync)

  // make sure it works
  var d = __dirname + '/a'
  t.notSame(fs.readdirSync(d), fs.readdirSync(d).sort())
  fs.readdir(__dirname + '/a', function (er, entries) {
    t.notSame(entries.slice(0), entries.sort())
    t.end()
  })
})

test('same match events with shuffled readdir', function (t) {
  var pattern = 'a/**/[gh]'
  var g = new Glob(pattern, { cwd: __dirname })
  var shuffleMatches = []
  g.on('match', function(m) {
    shuffleMatches.push(m)
  })
  g.on('end', function(set) {
    t.same(shuffleMatches, matches, 'should have same set of matches')
    t.end()
  })
})
