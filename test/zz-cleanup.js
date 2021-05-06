require("./global-leakage.js")
// remove the fixtures
process.env.TAP_BAIL = '1'
var tap = require("tap")
var fs = require('fs')
var rimraf = require("rimraf")
var path = require("path")
tap.pipe(fs.createWriteStream(path.resolve(__dirname, '../zz-cleanup.tap')))


tap.test("cleanup fixtures", function (t) {
  rimraf(path.resolve(__dirname, "fixtures"), function (er) {
    t.error(er, "removed")
    t.end()
  })
})
