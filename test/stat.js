var glob = require('../')
var test = require('tap').test
var path = require('path')

test('stat all the things', function(t) {
  var g = new glob.Glob('a/*abc*/**', { stat: true, cwd: __dirname })
  var matches = []
  g.on('match', function(m) {
    matches.push(m)
  })
  var stats = []
  g.on('stat', function(m) {
    stats.push(m)
  })
  g.on('end', function(eof) {
    stats = stats.sort()
    matches = matches.sort()
    eof = eof.sort()
    t.same(stats, eof, "stats match eof")
    t.same(matches, eof, "matches matches eof")
    var cache = Object.keys(this.statCache)
    t.same(cache.map(function (f) {
      return path.relative(__dirname, f).replace(/\\/g, '/')
    }).sort(), eof, "cache matches eof")

    cache.forEach(function(c) {
      t.equal(typeof this.statCache[c], 'object')
    }, this)

    t.end()
  })
})
