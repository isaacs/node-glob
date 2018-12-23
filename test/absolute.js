require('./global-leakage.js')
var t = require('tap')
var glob = require('../')
var path = require('path')
var common = require('../common.js')
var pattern = 'a/b/**';
var bashResults = require('./bash-results.json')
process.chdir(__dirname + '/fixtures')

t.Test.prototype.addAssert('isAbsolute', 1, function (file, message, extra) {
  extra.found = file
  return this.ok(path.isAbsolute(file), message || 'must be absolute', extra)
})

var marks = [ true, false ]
marks.forEach(function (mark) {
  t.test('mark=' + mark, function (t) {
    t.plan(2)

    t.test('Emits absolute matches if option set', function (t) {
      var g = new glob.Glob(pattern, { absolute: true })

      var matchCount = 0
      g.on('match', function (m) {
        t.isAbsolute(m)
        matchCount++
      })

      g.on('end', function (results) {
        t.equal(matchCount, bashResults[pattern].length, 'must match all files')
        t.equal(results.length, bashResults[pattern].length, 'must match all files')
        results.forEach(function (m) {
          t.isAbsolute(m)
        })
        t.end()
      })
    })

    t.test('returns absolute results synchronously', function (t) {
      var results = glob.sync(pattern, { absolute: true })

      t.equal(results.length, bashResults[pattern].length, 'must match all files')
      results.forEach(function (m) {
        t.ok(path.isAbsolute(m), 'must be absolute', { found: m })
      })
      t.end()
    })
  })
})
