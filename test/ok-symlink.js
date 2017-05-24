var fs = require('fs')
var test = require('tap').test
var glob = require('../')
var mkdirp = require('mkdirp')

if (process.platform === 'win32')
  return require('tap').plan(0, 'skip on windows')

process.chdir(__dirname)

var link = 'a/working-link/link/file'

var patterns = [
  'a/working-link/**',
]

test('set up working symlink', function (t) {
  cleanup()
  mkdirp.sync('a/working-link')
  mkdirp.sync('a/working-target');
  fs.writeFileSync('a/working-target/file.js','Content');
  fs.writeFileSync('a/working-target/file.txt','Content');
  fs.symlinkSync('../working-target', 'a/working-link/link')
  t.end()
})

test('async follow test', function (t) {
  var pattern = 'a/working-*/**/*.js';
  var expected = [
    'a/working-target/file.js',
    'a/working-link/link/file.js',
  ];
  glob(pattern, {follow:true}, cb())

  function cb () {
      return function (er, res) {
          if (er) throw er
          var msg = pattern + ' '
          res.forEach(function(item){
              t.notEqual(-1, expected.indexOf(item), msg + ' ' + item + ' found but not expected')
          });
          expected.forEach(function(item){
              t.notEqual(-1, res.indexOf(item), msg + ' ' + item + ' expected but not found')
          });
          t.end();
      }
  }
})

test('async nofollow test', function (t) {
  var pattern = 'a/working-*/**/*.js';
  var expected = [
    'a/working-target/file.js',
  ];
  glob(pattern, {follow:false}, cb())

  function cb () {
      return function (er, res) {
          if (er) throw er
          var msg = pattern + ' '
          res.forEach(function(item){
              t.notEqual(-1, expected.indexOf(item), msg + ' ' + item + ' found but not expected')
          });
          expected.forEach(function(item){
              t.notEqual(-1, res.indexOf(item), msg + ' ' + item + ' expected but not found')
          });
          t.end();
      }
  }
})

test('sync follow test', function (t) {
  var pattern = 'a/working-*/**/*.js';
  var expected = [
    'a/working-target/file.js',
    'a/working-link/link/file.js',
  ];
  res = glob.sync(pattern, {follow:true});

  var msg = pattern + ' '
  res.forEach(function(item){
      t.notEqual(-1, expected.indexOf(item), msg + ' ' + item + ' found but not expected')
  });
  expected.forEach(function(item){
      t.notEqual(-1, res.indexOf(item), msg + ' ' + item + ' expected but not found')
  });
  t.end();
})

test('sync nofollow test', function (t) {
  var pattern = 'a/working-*/**/*.js';
  var expected = [
    'a/working-target/file.js',
  ];
  res = glob.sync(pattern, {follow:false});

  var msg = pattern + ' '
  res.forEach(function(item){
      t.notEqual(-1, expected.indexOf(item), msg + ' ' + item + ' found but not expected')
  });
  expected.forEach(function(item){
      t.notEqual(-1, res.indexOf(item), msg + ' ' + item + ' expected but not found')
  });
  t.end();
})

test('cleanup', function (t) {
  cleanup()
  t.end()
})

function cleanup () {
  try { fs.unlinkSync('a/working-link/link') } catch (e) {}
  try { fs.unlinkSync('a/working-target/file.js') } catch (e) {}
  try { fs.unlinkSync('a/working-target/file.txt') } catch (e) {}
  try { fs.rmdirSync('a/working-link') } catch (e) {}
  try { fs.rmdirSync('a/working-target') } catch (e) {}
}
