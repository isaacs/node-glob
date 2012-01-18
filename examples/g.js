var MG = require("./").Miniglob

var pattern = "test/a/**/[cg]/../[cg]"
console.log(pattern)

var mg = new MG(pattern, {mark: true, sync:true}, function (er, matches) {
  console.log("matches", matches)
})
console.log("after")
