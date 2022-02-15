require("./global-leakage.js")
var test = require("tap").test
var glob = require('../')
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
  test(pattern + ' ' + JSON.stringify(options), async t => {
    var sync = glob.sync(pattern, options).sort()
    t.same(sync, expect, 'sync results')
    const res = (await glob(pattern, options)).sort()
    t.same(res, expect, 'async results')
  })
})
