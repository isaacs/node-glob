require("./global-leakage.js")
var test = require("tap").test
var glob = require('../')
process.chdir(__dirname + '/fixtures')

// expose timing issues
var lag = 5
glob.Glob.prototype._stat = function(o) { return function(f, cb) {
  var args = arguments
  setTimeout(function() {
    o.call(this, f, cb)
  }.bind(this), lag += 5)
}}(glob.Glob.prototype._stat)

test('mark with cwd', function (t) {
  var pattern = '*/*'
  var opt = { mark: true, cwd: 'a' }
  glob(pattern, opt, function (er, res) {
    if (er)
      throw er

    var expect = [
      'abcdef/g/',
      'abcfed/g/',
      'b/c/',
      'bc/e/',
      'c/d/',
      'cb/e/',
    ].sort()

    if (process.platform !== 'win32')
      expect.push('symlink/a/')

    t.same(res.sort(), expect)
    t.same(glob.sync(pattern, opt).sort(), expect)
    t.end()
  })
})

test("mark, with **", function (t) {
  var pattern = 'a/*b*/**'
  var opt = { mark: true }
  glob(pattern, opt, function (er, results) {
    if (er)
      throw er
    var expect =
      [ 'a/abcdef/',
        'a/abcdef/g/',
        'a/abcdef/g/h',
        'a/abcfed/',
        'a/abcfed/g/',
        'a/abcfed/g/h',
        'a/b/',
        'a/b/c/',
        'a/b/c/d',
        'a/bc/',
        'a/bc/e/',
        'a/bc/e/f',
        'a/cb/',
        'a/cb/e/',
        'a/cb/e/f' ]

    t.same(results, expect)
    t.same(glob.sync(pattern, opt), expect)
    t.end()
  })
})

test("mark, no / on pattern", function (t) {
  var pattern = 'a/*'
  var opt = { mark: true }
  glob(pattern, opt, function (er, results) {
    if (er)
      throw er
    var expect = [ 'a/abcdef/',
                   'a/abcfed/',
                   'a/b/',
                   'a/bc/',
                   'a/c/',
                   'a/cb/',
                   'a/x/',
                   'a/z/' ]

    if (process.platform !== "win32")
      expect.push('a/symlink/')

    expect = expect.sort()

    t.same(results, expect)
    t.same(glob.sync(pattern, opt), expect)
    t.end()
  }).on('match', function(m) {
    t.match(m, /\/$/)
  })
})

test("mark=false, no / on pattern", function (t) {
  var pattern = 'a/*'
  var opt = null
  glob(pattern, opt, function (er, results) {
    if (er)
      throw er
    var expect = [ 'a/abcdef',
                   'a/abcfed',
                   'a/b',
                   'a/bc',
                   'a/c',
                   'a/cb',
                   'a/x',
                   'a/z' ]

    if (process.platform !== "win32")
      expect.push('a/symlink')

    expect = expect.sort()

    t.same(results, expect)
    t.same(glob.sync(pattern, opt), expect)
    t.end()
  }).on('match', function(m) {
    t.match(m, /[^\/]$/)
  })
})

test("mark=true, / on pattern", function (t) {
  var pattern = 'a/*/'
  var opt = { mark: true }
  glob(pattern, opt, function (er, results) {
    if (er)
      throw er
    var expect = [ 'a/abcdef/',
                    'a/abcfed/',
                    'a/b/',
                    'a/bc/',
                    'a/c/',
                    'a/cb/',
                    'a/x/',
                    'a/z/' ]

    if (process.platform !== "win32")
      expect.push('a/symlink/')

    expect = expect.sort()

    t.same(results, expect)
    t.same(glob.sync(pattern, opt), expect)
    t.end()
  }).on('match', function(m) {
    t.match(m, /\/$/)
  })
})

test("mark=false, / on pattern", function (t) {
  var pattern = "a/*/"
  var opt = null
  glob(pattern, opt, function (er, results) {
    if (er)
      throw er
    var expect = [ 'a/abcdef/',
                   'a/abcfed/',
                   'a/b/',
                   'a/bc/',
                   'a/c/',
                   'a/cb/',
                   'a/x/',
                   'a/z/' ]
    if (process.platform !== "win32")
      expect.push('a/symlink/')

    expect = expect.sort()

    t.same(results, expect)
    t.same(glob.sync(pattern, opt), expect)
    t.end()
  }).on('match', function(m) {
    t.match(m, /\/$/)
  })
})

var cwd = process.cwd().replace(/[\/\\]+$/, '').replace(/\\/g, '/')
;[true,false].forEach(function (mark) {
  ;[true,false].forEach(function (slash) {
    test("cwd mark:" + mark + " slash:" + slash, function (t) {
      var pattern = cwd + (slash ? '/' : '')
      glob(pattern, {mark:mark}, function (er, results) {
        t.equal(results.length, 1)
        var res = results[0].replace(/\\/g, '/')
        var syncRes = glob.sync(pattern, {mark:mark})
        syncRes = syncRes[0].replace(/\\/g, '/')
        if (slash || mark)
          t.equal(res, cwd + '/')
        else
          t.equal(res.indexOf(cwd), 0)
        t.equal(syncRes, res, 'sync should match async')
        t.end()
      })
    })
  })
})

