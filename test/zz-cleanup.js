// remove the fixtures
var tap = require("tap")
, rimraf = require("rimraf")
, path = require("path")

tap.test("cleanup fixtures", { skip: true }, function (t) {
  rimraf(path.resolve(__dirname, "a"), function (er) {
    t.ifError(er, "removed")
    t.end()
  })
})
