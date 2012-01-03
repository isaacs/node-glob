var MG = require("./").Miniglob

var mg = new MG("a/**/[cg]")//, {debug:true})
mg.on("end", function (matches) {
  console.error("in the end")
  console.log("matches", matches)
})
