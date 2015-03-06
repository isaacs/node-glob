var fs = require('fs')
var test = require('tap').test
var glob = require('../')
var mkdirp = require('mkdirp')

process.chdir(__dirname)

var link = 'a/broken-link/link'

var patterns = [
  'a/broken-link/*',
  'a/broken-link/**',
  'a/broken-link/**/link',
  'a/broken-link/**/*',
  'a/broken-link/link',
  'a/broken-link/{link,asdf}',
  'a/broken-link/+(link|asdf)',
  'a/broken-link/!(asdf)'
]

var opts = [
  null,
  { nonull: true },
  { mark: true },
  { stat: true },
  { follow: true }
]

test('set up broken symlink', function (t) {
  cleanup()
  mkdirp.sync('a/broken-link')
  fs.symlinkSync('this-does-not-exist', 'a/broken-link/link')
  t.end()
})

test('async test', function (t) {
  var count = patterns.length * opts.length
  t.plan(patterns.length)
  patterns.forEach(function (pattern) {
    t.test(pattern, function (t) {
      t.plan(opts.length)

      opts.forEach(function (opt) {
        glob(pattern, opt, cb(opt))
      })

      function cb (opt) { return function (er, res) {
        if (er)
          throw er
        var msg = pattern + ' ' + JSON.stringify(opt)
        t.notEqual(res.indexOf(link), -1, msg)
      }}
    })
  })
})

test('sync test', function (t) {
  t.plan(patterns.length)
  patterns.forEach(function (pattern) {
    t.test(pattern, function (t) {
      t.plan(opts.length)

      opts.forEach(function (opt) {
        var res = glob.sync(pattern, opt)
        t.notEqual(res.indexOf(link), -1, 'opt=' + JSON.stringify(opt))
      })
    })
  })
})

test('cleanup', function (t) {
  cleanup()
  t.end()
})

function cleanup () {
  try { fs.unlinkSync('a/broken-link/link') } catch (e) {}
  try { fs.rmdirSync('a/broken-link') } catch (e) {}
}
