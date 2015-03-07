require("./global-leakage.js")
var test = require("tap").test
var glob = require('../')
process.chdir(__dirname)

// [pattern, options, expect]
var cases = [
  [ '*/**', { cwd: 'a' }, [
      'abcdef/g/h',
      'abcfed/g/h',
      'b/c/d',
      'bc/e/f',
      'c/d/c/b',
      'cb/e/f'
    ]
  ],
  [ 'a/*b*/**', {}, [
      'a/abcdef/g/h',
      'a/abcfed/g/h',
      'a/b/c/d',
      'a/bc/e/f',
      'a/cb/e/f'
    ]
  ],
  [ 'a/*b*/**/', {}, [] ],
  [ '*/*', { cwd: 'a' }, [] ]
]

cases.forEach(function (c) {
  var pattern = c[0]
  var options = c[1] || {}
  options.nodir = true
  var expect = c[2].sort()
  test(pattern + ' ' + JSON.stringify(options), function (t) {
    var res = glob.sync(pattern, options).sort()
    t.same(res, expect, 'sync results')
    glob(pattern, options, function (er, res) {
      if (er)
        throw er
      res = res.sort()
      t.same(res, expect, 'async results')
      t.end()
    })
  })
})
