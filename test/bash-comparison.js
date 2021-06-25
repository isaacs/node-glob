// basic test
// show that it does the same thing by default as the shell.
require("./global-leakage.js")
var tap = require("tap")
var child_process = require("child_process")
var bashResults = require("./bash-results.json")
var globs = Object.keys(bashResults)
var glob = require("../")
var path = require("path")
var isAbsolute = require("path-is-absolute")

// run from the root of the project
// this is usually where you're at anyway, but be sure.
var root = path.dirname(__dirname)
var fixtures = path.resolve(__dirname, 'fixtures')
process.chdir(fixtures)

function cacheCheck(g, t) {
  // verify that path cache keys are all absolute
  var caches = [ 'cache', 'statCache', 'symlinks' ]
  caches.forEach(function (c) {
    Object.keys(g[c]).forEach(function (p) {
      t.ok(isAbsolute(p), p + ' should be absolute')
    })
  })
}

function alphasort (a, b) {
  a = a.toLowerCase()
  b = b.toLowerCase()
  return a > b ? 1 : a < b ? -1 : 0
}

globs.forEach(function (pattern) {
  var expect = bashResults[pattern]
  // anything regarding the symlink thing will fail on windows, so just skip it
  if (process.platform === "win32" &&
      expect.some(function (m) {
        return /\bsymlink\b/.test(m)
      }))
    return

  tap.test(pattern, function (t) {
    var g = glob(pattern, function (er, matches) {
      if (er)
        throw er

      // sort and unmark, just to match the shell results
      matches = cleanResults(matches)
      t.same(matches, expect, pattern)

      // verify that path cache keys are all absolute
      cacheCheck(g, t)
      t.end()
    })
  })

  tap.test(pattern + " sync", function (t) {
    var matches = cleanResults(glob.sync(pattern))

    t.same(matches, expect, "should match shell (sync)")
    t.end()
  })
})

function cleanResults (m) {
  // normalize discrepancies in ordering, duplication,
  // and ending slashes.
  return m.map(function (m) {
    return m.replace(/\/+/g, "/").replace(/\/$/, "")
  }).sort(alphasort).reduce(function (set, f) {
    if (f !== set[set.length - 1]) set.push(f)
    return set
  }, []).map(function (f) {
    // de-windows
    return (process.platform !== 'win32') ? f
           : f.replace(/^[a-zA-Z]:[\/\\]+/, '/').replace(/[\\\/]+/g, '/')
  }).sort(alphasort)
}
