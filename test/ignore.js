require('./global-leakage.js')
// Ignore option test
// Show that glob ignores results matching pattern on ignore option

var glob = require('../glob.js')
var test = require('tap').test

// [pattern, ignore, expect, cwd]
var cases = [
  [ '*', null, ['abcdef', 'abcfed', 'b', 'bc', 'c', 'cb', 'symlink'], 'a'],
  [ '*', 'b', ['abcdef', 'abcfed', 'bc', 'c', 'cb', 'symlink'], 'a'],
  [ '*', 'b*', ['abcdef', 'abcfed', 'c', 'cb', 'symlink'], 'a'],
  [ 'b/**', 'b/c/d', ['b', 'b/c'], 'a'],
  [ 'b/**', 'd', ['b', 'b/c', 'b/c/d'], 'a'],
  [ 'b/**', 'b/c/**', ['b'], 'a'],
  [ '**/d', 'b/c/d', ['c/d'], 'a'],
  [ 'a/**/[gh]', ['a/abcfed/g/h'], ['a/abcdef/g', 'a/abcdef/g/h', 'a/abcfed/g']],
  [ '*', ['c', 'bc', 'symlink', 'abcdef'], ['abcfed', 'b', 'cb'], 'a'],
  [ '**', ['c/**', 'bc/**', 'symlink/**', 'abcdef/**'], ['abcfed', 'abcfed/g', 'abcfed/g/h', 'b', 'b/c', 'b/c/d', 'cb', 'cb/e', 'cb/e/f'], 'a'],
  [ 'a/**', ['a/**'], []],
  [ 'a/**', ['a/**/**'], []],
  [ 'a/b/**', ['a/b'], ['a/b/c', 'a/b/c/d']],
  [ '**', ['b'], ['abcdef', 'abcdef/g', 'abcdef/g/h', 'abcfed', 'abcfed/g', 'abcfed/g/h', 'b/c', 'b/c/d', 'bc', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c'], 'a'],
  [ '**', ['b', 'c'], ['abcdef', 'abcdef/g', 'abcdef/g/h', 'abcfed', 'abcfed/g', 'abcfed/g/h', 'b/c', 'b/c/d', 'bc', 'bc/e', 'bc/e/f', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c'], 'a'],
  [ '**', ['b**'], ['abcdef', 'abcdef/g', 'abcdef/g/h', 'abcfed', 'abcfed/g', 'abcfed/g/h', 'b/c', 'b/c/d', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c'], 'a'],
  [ '**', ['b/**'], ['abcdef', 'abcdef/g', 'abcdef/g/h', 'abcfed', 'abcfed/g', 'abcfed/g/h', 'bc', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c'], 'a'],
  [ '**', ['b**/**'], ['abcdef', 'abcdef/g', 'abcdef/g/h', 'abcfed', 'abcfed/g', 'abcfed/g/h', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c'], 'a'],
  [ '**', ['ab**ef/**'], ['abcfed', 'abcfed/g', 'abcfed/g/h', 'b', 'b/c', 'b/c/d', 'bc', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c'], 'a'],
  [ '**', ['abc{def,fed}/**'], ['b', 'b/c', 'b/c/d', 'bc', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c'], 'a'],
  [ '**', ['abc{def,fed}/*'], ['abcdef', 'abcdef/g/h', 'abcfed', 'abcfed/g/h', 'b', 'b/c', 'b/c/d', 'bc', 'bc/e', 'bc/e/f', 'c', 'c/d', 'c/d/c', 'c/d/c/b', 'cb', 'cb/e', 'cb/e/f', 'symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c'], 'a'],
  [ 'c/**', ['c/*'], ['c', 'c/d/c', 'c/d/c/b'], 'a'],
  [ 'a/c/**', ['a/c/*'], ['a/c', 'a/c/d/c', 'a/c/d/c/b']],
  [ 'a/c/**', ['a/c/**', 'a/c/*', 'a/c/*/c'], []]
]

process.chdir(__dirname)

cases.forEach(function (c, i) {
  var pattern = c[0]
  var ignore = c[1]
  var expect = c[2].sort()
  var cwd = c[3]
  var name = i + ' ' + pattern + ' ' + JSON.stringify(ignore)
  if (cwd)
    name += ' cwd=' + cwd

  var opt = { ignore: ignore }
  if (cwd)
    opt.cwd = cwd

  test(name, function (t) {
    glob(pattern, opt, function (er, res) {
      if (er)
        throw er
      t.same(res.sort(), expect, 'async')
      res = glob.sync(pattern, opt)
      t.same(res.sort(), expect, 'sync')
      t.end()
    })
  })
})
