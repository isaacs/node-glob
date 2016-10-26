require("./global-leakage.js")

var fs = require('fs')
var test = require('tap').test
var glob = require('../')

// pattern to (potentially) trigger all fs calls
var pattern = 'a/symlink/**/c'

// on win32, the fixtures will not include symlink, so use a different pattern
// and adjust expectations of stat / statSync being called
var win32 = process.platform === 'win32'
if (win32)
  pattern = 'a/bc/**/f'


var asyncCases = [
  // all adapter functions are called for our pattern, except stat on win32
  { readdir: true, stat: !win32, lstat: true },

  // stat is called instead of lstat if adapter doesn't implement it
  { readdir: true, stat: true }
]

var syncCases = [
  // all adapter functions are called for our pattern, except statSync on win32
  { readdirSync: true, statSync: !win32, lstatSync: true },

  // statSync is called instead of lstatSync if adapter doesn't implement it
  { readdirSync: true, statSync: true }
]


process.chdir(__dirname + '/fixtures')


asyncCases.forEach(function(exp) {
  test('fs adapter ' + JSON.stringify(exp), function(t) {
    var fns = Object.keys(exp)
    var opt = { fs: {} }
    var spy = _spy(fns, opt)
    glob(pattern, opt, function() {
      fns.forEach(function(fn) {
        t.ok(spy[fn] === exp[fn], 'expect ' + fn  + ' called: ' + exp[fn])
      })
      t.end()
    })
  })
})


syncCases.forEach(function(exp) {
  test('fs adapter ' + JSON.stringify(exp), function(t) {
    var fns = Object.keys(exp)
    var opt = { fs: {} }
    var spy = _spy(fns, opt)
    glob.sync(pattern, opt)
    fns.forEach(function(fn) {
      t.ok(spy[fn] === exp[fn], 'expect ' + fn  + ' called: ' + exp[fn])
    })
    t.end()
  })
})


function _spy(fns, opt) {
  var spy = {}
  fns.forEach(function(fn) {
    spy[fn] = false
    opt.fs[fn] = function() {
      spy[fn] = true
      return fs[fn].apply(null, arguments)
    }
  })
  return spy
}
