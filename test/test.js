var g = require("../lib/glob")

try {
  console.log(g.globSync("*", 0))
  console.log(g.globSync("*/*.js", 0))
  console.log(g.globSync("lib/*", 0))
  console.log(g.globSync("~/*", g.GLOB_TILDE))
} catch (ex) {
  console.log(ex.stack)
}

g.glob("*", 0, function (er, m) {
  console.log(er, m)
  g.glob("*/*.js", 0, function (er, m) {
    console.log(er, m)
    g.glob("lib/*", 0, function (er, m) {
      console.log(er, m)
      g.glob("~/*", 0 | g.GLOB_TILDE, function(er, m) {
        console.log(er, m)
        console.log("ok")
      })
    })
  })
})

function f (pattern, str, flags, expect) {
  if (arguments.length === 3) expect = flags, flags = undefined
  if (g.fnmatch(pattern, str, flags) !== expect) {
    throw new Error(JSON.stringify([pattern,str,flags]) + " expected "+expect)
  }
  console.error("%s, %s, %s => %j", pattern, str, flags, expect)
}

f("*", "foo", true)
f(".*", "foo", false)
f("*", ".foo", false)
f("*", "foo/bar", false)
f("*/*", "foo/bar", true)
f("*", ".foo", g.FNM_DEFAULT & ~g.FNM_PERIOD, true)
f("*/*", "foo/bar", g.FNM_DEFAULT & ~g.FNM_PATHNAME, true)

