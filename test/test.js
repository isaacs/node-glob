// var g = require("../lib/glob")
var g = require("../build/default/glob")

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
