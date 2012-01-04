var MG = require("./").Miniglob

var mg = new MG("a/**/[cg]/../[cg]")//, {debug:true})
mg.on("end", function (matches) {
  console.log("matches", matches)
})
