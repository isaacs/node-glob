var MG = require("./").Miniglob

var pattern = "test/a/**/[cg]/../[cg]"
console.log(pattern)

var mg = new MG(pattern, {mark: true})
mg.on("end", function (matches) {
  console.log("matches", matches)
})
