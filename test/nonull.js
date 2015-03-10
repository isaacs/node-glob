require("./global-leakage.js")
var test = require("tap").test
var glob = require('../')
var common = require('../common.js')
process.chdir(__dirname)

// [pattern, options, expect]
var cases = [
  [ 'a/*NOFILE*/**/', {}, [ 'a/*NOFILE*/**/' ] ],
  [ '*/*', { cwd: 'NODIR' }, [ '*/*' ] ],
  [ 'NOFILE', {}, [ 'NOFILE' ] ],
  [ 'NOFILE', { cwd: 'NODIR' }, [ 'NOFILE' ] ]
]

cases.forEach(function (c) {
  var pattern = c[0]
  var options = c[1] || {}
  options.nonull = true
  var expect = c[2].sort()
  test(pattern + ' ' + JSON.stringify(options), function (t) {
    var res = glob.sync(pattern, options).sort()
    t.same(res, expect, 'sync results')
    var g = glob(pattern, options, function (er, res) {
      if (er)
        throw er
      res = res.sort()
      t.same(res, expect, 'async results')
      t.end()
    })
  })
})
