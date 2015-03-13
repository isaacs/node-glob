var glob = require('../')
var test = require('tap').test
// pattern to find a bunch of duplicates
var pattern = 'a/symlink/{*,**/*/*/*,*/*/**,*/*/*/*/*/*}'
process.chdir(__dirname)
var path = require('path')

// options, results
// realpath:true set on each option
var cases = [
  [ {},
    [ 'a/symlink', 'a/symlink/a', 'a/symlink/a/b' ] ],

  [ { mark: true },
    [ 'a/symlink/', 'a/symlink/a/', 'a/symlink/a/b/' ] ],

  [ { stat: true },
    [ 'a/symlink', 'a/symlink/a', 'a/symlink/a/b' ] ],

  [ { follow: true },
    [ 'a/symlink', 'a/symlink/a', 'a/symlink/a/b' ] ],

  [ { cwd: 'a' },
    [ 'symlink', 'symlink/a', 'symlink/a/b' ],
    pattern.substr(2) ],

  [ { cwd: 'a' },
    [],
    'no one here but us chickens' ],

  [ { nonull: true },
    [ 'no one here but us chickens',
      'no one here but us sheep' ],
    'no one here but us {chickens,sheep}' ],

  [ { nounique: true },
    [ 'a/symlink',
      'a/symlink',
      'a/symlink',
      'a/symlink/a',
      'a/symlink/a',
      'a/symlink/a/b',
      'a/symlink/a/b' ] ],

  [ { nounique: true, mark: true },
    [ 'a/symlink/',
      'a/symlink/',
      'a/symlink/',
      'a/symlink/a/',
      'a/symlink/a/',
      'a/symlink/a/b/',
      'a/symlink/a/b/' ] ],

  [ { nounique: true, mark: true, follow: true },
    [ 'a/symlink/',
      'a/symlink/',
      'a/symlink/',
      'a/symlink/a/',
      'a/symlink/a/',
      'a/symlink/a/',
      'a/symlink/a/b/',
      'a/symlink/a/b/' ] ],
]

cases.forEach(function (c) {
  var opt = c[0]
  var expect = c[1]
  if (!(opt.nonull && expect[0].match(/^no one here/))) {
    expect = expect.map(function (d) {
      d = (opt.cwd ? path.resolve(opt.cwd) : __dirname) + '/' + d
      return d.replace(/\\/g, '/')
    })
  }
  var p = c[2] || pattern

  opt.realpath = true

  test(JSON.stringify(opt), function (t) {
    opt.realpath = true
    var sync = glob.sync(p, opt)
    t.same(sync, expect, 'sync')
    glob(p, opt, function (er, async) {
      if (er)
        throw er
      t.same(async, expect, 'async')
      t.end()
    })
  })
})
