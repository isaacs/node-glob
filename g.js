var MG = require("./").Miniglob

var mg = new MG("a/**/[cg]/../[cg]", {mark: true})
mg.on("end", function (matches) {
  console.log("matches", matches)
})
