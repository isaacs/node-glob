// pause-resume-end test
// show 'end' event is emitted properly
require("./global-leakage.js")
var tap = require("tap")
var child_process = require("child_process")
var bashResults = require("./bash-results.json")
var globs = Object.keys(bashResults)
var glob = require("../")
var path = require("path")

// run from the root of the project
// this is usually where you're at anyway, but be sure.
var root = path.dirname(__dirname)
var fixtures = path.resolve(__dirname, 'fixtures')
process.chdir(fixtures)



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

  tap.test(pattern + " reaches end correctly when pause/resume", function (t) {
    var g = new glob.Glob(pattern, function (er, matches) {
      if (er)
        throw er

      // sort and unmark, just to match the shell results
      matches = cleanResults(matches)
      t.deepEqual(matches, expect, pattern) //deep detect if end yields expected matches

      t.end()
    })
    .on('match',function(m) {

      //pause and then resume after every match
      g.pause()
      setTimeout(g.resume.bind(g), 10)
    })
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
