require("./global-leakage.js")
var glob = require('../')
var test = require('tap').test
var path = require('path')
var Stats = require('fs').Stats
var dir = __dirname + '/fixtures'

test('stat all the things', function(t) {
  var g = new glob.Glob('a/*abc*/**', { stat: true, cwd: dir })
  var matches = []
  g.on('match', function(m) {
    matches.push(m)
  })
  var stats = []
  g.on('stat', function(m, st) {
    stats.push(m)
    t.ok(st instanceof Stats)
  })
  g.on('end', function(eof) {
    stats = stats.sort()
    matches = matches.sort()
    eof = eof.sort()
    t.same(stats, matches)
    t.same(eof, matches)
    var cache = Object.keys(this.statCache)
    t.same(cache.map(function (f) {
      return path.relative(dir, f).replace(/\\/g, '/')
    }).sort(), matches)

    cache.forEach(function(c) {
      t.equal(typeof this.statCache[c], 'object')
    }, this)

    t.end()
  })
})
