require('./global-leakage.js')
// Ignore option test
// Show that glob ignores results matching pattern on ignore option

var glob = require('../glob.js')
var test = require('tap').test

// [pattern, ignore, expect, opt (object) or cwd (string)]
var cases = [
  [ '*', null, ['abcdef', 'abcfed', 'b', 'bc', 'c', 'cb', 'symlink', 'x', 'z'], 'a'],
  [ '*', 'b', ['abcdef', 'abcfed', 'bc', 'c', 'cb', 'symlink', 'x', 'z'], 'a'],
  [ '*', 'b*', ['abcdef', 'abcfed', 'c', 'cb', 'symlink', 'x', 'z'], 'a'],
  [ 'b/**', 'b/c/d', ['b', 'b/c'], 'a'],
  [ 'b/**', 'd', ['b', 'b/c', 'b/c/d'], 'a'],
  [ 'b/**', 'b/c/**', ['b'], 'a'],
  [ '**/d', 'b/c/d', ['c/d'], 'a'],
  [ 'a/**/[gh]', ['a/abcfed/g/h'], ['a/abcdef/g', 'a/abcdef/g/h', 'a/abcfed/g']],
  [ '*', ['c', 'bc', 'symlink', 'abcdef'], ['abcfed', 'b', 'cb', 'x', 'z'], 'a'],
  [ '**', ['c/**', 'bc/**', 'symlink/**', 'abcdef/**'], ['abcfed', 'abcfed/g', 'abcfed/g/h', 'b', 'b/c', 'b/c/d', 'cb', 'cb/e', 'cb/e/f', 'x', 'z'], 'a'],
  [ 'a/**', ['a/**'], []],
  [ 'a/**', ['a/**/**'], []],
  [ 'a/b/**', ['a/b'], ['a/b/c', 'a/b/c/d']],
  [ '**', ['b'], ['abcdef', 'abcdef/g', 'abcdef/g/h', 'abcfed', 'abcfed/g', 'abcfed/g/h', 'b/c', 'b/c/d', 'bc', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c', 'x', 'z'], 'a'],
  [ '**', ['b', 'c'], ['abcdef', 'abcdef/g', 'abcdef/g/h', 'abcfed', 'abcfed/g', 'abcfed/g/h', 'b/c', 'b/c/d', 'bc', 'bc/e', 'bc/e/f', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c', 'x', 'z'], 'a'],
  [ '**', ['b**'], ['abcdef', 'abcdef/g', 'abcdef/g/h', 'abcfed', 'abcfed/g', 'abcfed/g/h', 'b/c', 'b/c/d', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c', 'x', 'z'], 'a'],
  [ '**', ['b/**'], ['abcdef', 'abcdef/g', 'abcdef/g/h', 'abcfed', 'abcfed/g', 'abcfed/g/h', 'bc', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c', 'x', 'z'], 'a'],
  [ '**', ['b**/**'], ['abcdef', 'abcdef/g', 'abcdef/g/h', 'abcfed', 'abcfed/g', 'abcfed/g/h', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c', 'x', 'z'], 'a'],
  [ '**', ['ab**ef/**'], ['abcfed', 'abcfed/g', 'abcfed/g/h', 'b', 'b/c', 'b/c/d', 'bc', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c', 'x', 'z'], 'a'],
  [ '**', ['abc{def,fed}/**'], ['b', 'b/c', 'b/c/d', 'bc', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c', 'x', 'z'], 'a'],
  [ '**', ['abc{def,fed}/*'], ['abcdef', 'abcdef/g/h', 'abcfed', 'abcfed/g/h', 'b', 'b/c', 'b/c/d', 'bc', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c', 'x', 'z'], 'a'],
  [ 'c/**', ['c/*'], ['c', 'c/d/c', 'c/d/c/b'], 'a'],
  [ 'a/c/**', ['a/c/*'], ['a/c', 'a/c/d/c', 'a/c/d/c/b']],
  [ 'a/c/**', ['a/c/**', 'a/c/*', 'a/c/*/c'], []],
  [ 'a/**/.y', ['a/x/**'], ['a/z/.y']],
  [ 'a/**/.y', ['a/x/**'], ['a/z/.y'], { dot: true }],
  [ 'a/**/b', ['a/x/**'], ['a/b', 'a/c/d/c/b', 'a/symlink/a/b']],
  [ 'a/**/b', ['a/x/**'], ['a/b', 'a/c/d/c/b', 'a/symlink/a/b', 'a/z/.y/b'], { dot: true }],
  [ '*/.abcdef', 'a/**', [] ],
  [ 'a/*/.y/b', 'a/x/**', [ 'a/z/.y/b' ] ]
]

process.chdir(__dirname + '/fixtures')

cases.forEach(function (c, i) {
  var pattern = c[0]
  var ignore = c[1]
  var expect = c[2].sort()
  var opt = c[3]
  var name = i + ' ' + pattern + ' ' + JSON.stringify(ignore)
  if (typeof opt === 'string')
    opt = { cwd: opt }

  if (opt)
    name += ' ' + JSON.stringify(opt)
  else
    opt = {}

  var matches = []

  opt.ignore = ignore

  test(name, function (t) {
    glob(pattern, opt, function (er, res) {
      if (er)
        throw er

      if (process.platform === 'win32') {
        expect = expect.filter(function (f) {
          return !/\bsymlink\b/.test(f)
        })
      }

      t.same(res.sort(), expect, 'async')
      t.same(matches.sort(), expect, 'match events')
      res = glob.sync(pattern, opt)
      t.same(res.sort(), expect, 'sync')
      t.end()
    }).on('match', function (p) {
      matches.push(p)
    })
  })
})

test('race condition', function (t) {
  process.chdir(__dirname)
  var pattern = 'fixtures/*'
  ;[true, false].forEach(function (dot) {
    ;['fixtures/**', null].forEach(function (ignore) {
      ;[false, true].forEach(function (nonull) {
        ;[false, process.cwd(), '.'].forEach(function (cwd) {
          var opt = {
            dot: dot,
            ignore: ignore,
            nonull: nonull,
          }
          if (cwd)
            opt.cwd = cwd
          var expect = ignore ? [] : [ 'fixtures/a' ]
          t.test(JSON.stringify(opt), function (t) {
            t.plan(2)
            t.same(glob.sync(pattern, opt), expect)
            glob(pattern, opt).on('end', function (res) {
              t.same(res, expect)
            })
          })
        })
      })
    })
  })
  t.end()
})
