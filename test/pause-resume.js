require("./global-leakage.js")
// show that no match events happen while paused.
var tap = require("tap")
var child_process = require("child_process")
// just some gnarly pattern with lots of matches
var pattern = "a/!(symlink)/**"
var bashResults = require("./bash-results.json")
var glob = require("../")
var Glob = glob.Glob
var path = require("path")

process.chdir(__dirname + '/fixtures')

function alphasort (a, b) {
  a = a.toLowerCase()
  b = b.toLowerCase()
  return a > b ? 1 : a < b ? -1 : 0
}

function cleanResults (m) {
  // normalize discrepancies in ordering, duplication,
  // and ending slashes.
  return m.map(function (m) {
    return m.replace(/\/+/g, "/").replace(/\/$/, "")
  }).sort(alphasort).reduce(function (set, f) {
    if (f !== set[set.length - 1]) set.push(f)
    return set
  }, []).sort(alphasort).map(function (f) {
    // de-windows
    return (process.platform !== 'win32') ? f
           : f.replace(/^[a-zA-Z]:\\\\/, '/').replace(/\\/g, '/')
  })
}

var globResults = []
tap.test("use a Glob object, and pause/resume it", function (t) {
  var g = new Glob(pattern)
  var paused = false
  var res = []
  var expect = bashResults[pattern]

  g.on("match", function (m) {
    t.notOk(g.paused, "must not be paused")
    globResults.push(m)
    g.pause()
    t.ok(g.paused, "must be paused")
    setTimeout(g.resume.bind(g), 10)
  })

  g.on("end", function (matches) {
    t.pass("reached glob end")
    globResults = cleanResults(globResults)
    matches = cleanResults(matches)
    t.same(matches, globResults,
      "end event matches should be the same as match events")

    t.same(matches, expect,
      "glob matches should be the same as bash results")

    t.end()
  })
})

