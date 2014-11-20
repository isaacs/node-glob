require("./global-leakage.js")
var test = require("tap").test
var glob = require('../')
var assert = require("assert")
var fs = require("fs")
process.chdir(__dirname)

test("abort prevents any action", function (t) {
  glob("a/**").abort()
  glob("a/").abort()
  glob("a/b/*").abort()

  glob.Glob.prototype.emit = fs.readdir = fs.stat = fs.lstat = assert.fail

  setTimeout(function () {
    t.pass("if it gets here then it worked")
    t.end()
  }, 100)
})
