require("./global-leakage.js")
var test = require("tap").test
var glob = require('../')
var path = require('path')
var isAbsolute = require('path-is-absolute')
process.chdir(__dirname + '/fixtures')

function cacheCheck(g, t) {
  // verify that path cache keys are all absolute
  var caches = [ 'cache', 'statCache', 'symlinks' ]
  caches.forEach(function (c) {
    Object.keys(g[c]).forEach(function (p) {
      t.ok(isAbsolute(p), p + ' should be absolute')
    })
  })
}

// [pattern, options, expect]
var root = path.resolve('a')
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
  [ '*/*', { cwd: 'a' }, [] ],
  [ '/*/*', { root: root }, [] ],
  [ '/b*/**', { root: root }, [
      '/b/c/d',
      '/bc/e/f'
    ].map(function (m) {
      return path.join(root, m).replace(/\\/g, '/')
    })
  ]
]

cases.forEach(function (c) {
  var pattern = c[0]
  var options = c[1] || {}
  options.nodir = true
  var expect = c[2].sort()
  test(pattern + ' ' + JSON.stringify(options), function (t) {
    var res = glob.sync(pattern, options).sort()
    t.same(res, expect, 'sync results')
    var g = glob(pattern, options, function (er, res) {
      if (er)
        throw er
      res = res.sort()
      t.same(res, expect, 'async results')
      cacheCheck(g, t)
      t.end()
    })
  })
})
