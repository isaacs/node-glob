var g = require("../lib/glob")
  , gt = new g.glob_t()

console.log(g.globSync("*", 0, gt))
console.log(g.globSync("*/*.js", g.GLOB_APPEND, gt))

g.glob("*/*/*.js", g.GLOB_APPEND, gt, function (er, ok) {
  console.log(er, ok)
})
