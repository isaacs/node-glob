// basic test
// show that it does the same thing by default as the shell.
var tap = require("tap")
, child_process = require("child_process")
, globs = ["test/a/**/[cg]/../[cg]"]
, mg = require("../")
, path = require("path")

// run from the root of the project
// this is usually where you're at anyway, but be sure.
process.chdir(path.resolve(__dirname, ".."))

globs.forEach(function (pattern) {
  var echoOutput
  tap.test(pattern, function (t) {
    var cp = child_process.spawn("bash", ["-c",
        "shopt -s globstar;" +
        "shopt -s extglob;" +
        "for i in " + pattern + "; do echo $i; done"])
    , out = []
    , globResult
    cp.stdout.on("data", function (c) {
      out.push(c)
    })
    cp.on("exit", function () {
      echoOutput = flatten(out).split(/\r*\n/)
      next()
    })

    mg(pattern, function (er, matches) {
      t.ifError(er, pattern + " should not error")
      globResult = matches
      next()
    })

    function next () {
      if (!echoOutput || !globResult) return

      t.deepEqual(globResult, echoOutput, "should match shell")
      t.end()
    }
  })

  tap.test(pattern + " sync", function (t) {
    t.deepEqual(mg.sync(pattern), echoOutput, "should match shell")
    t.end()
  })
})

function flatten (chunks) {
  var s = 0
  chunks.forEach(function (c) { s += c.length })
  var out = new Buffer(s)
  s = 0
  chunks.forEach(function (c) {
    c.copy(out, s)
    s += c.length
  })

  return out.toString().trim()
}
