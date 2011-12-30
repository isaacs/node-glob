var MG = require("./").Miniglob

var mg = new MG("a/**/{c,g}")
mg.findAll(function (matches) {
  console.log("matches", matches)
})
