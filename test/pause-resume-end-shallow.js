// pause-resume-end test
// show 'end' event is emitted properly
require("./global-leakage.js")

var tap = require("tap")
var bashResults = require("./bash-results.json")
var globs = Object.keys(bashResults)
var glob = require("../")
var Glob = glob.Glob

process.chdir(__dirname + '/fixtures')

globs.forEach(function (pattern) {
  var expect = bashResults[pattern]

  if (process.platform === "win32" &&
      expect.some(function (m) {
        return /\bsymlink\b/.test(m)
      }))
    return

  tap.test(pattern + " reaches end correctly when pause/resume", function (t) {

    var g = new glob.Glob(pattern)
    g.on("match", function (m) {
      //pause and then resume after every match
      g.pause()
      setTimeout(g.resume.bind(g), 10)
    })

    g.on("end", function (matches) {
      if(matches.length == expect.length) { //shallow detect if end yields expected matches
        t.pass("reached glob end after matching completed")
        t.end()
      }else if(matches.length < expect.length) {  //ensure if end yields less than expected matches
        g.abort();
        t.fail("reached glob end before matching completed")
        t.end()
      }
    })
  })
})
