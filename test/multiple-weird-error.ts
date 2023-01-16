var t = require('tap')
var fs = require('fs')
fs.readdir = function(path, cb) { cb(new Error('expected')) }
var glob = require('../')

// also test that silent:true is actually silent!
console.error = function () { throw 'SILENCE, INSECT!' }

t.plan(2)
glob('*', { silent: true }, function(err, files) {
  t.ok(err, 'got first error')
})
glob('*', { silent: true }, function(err, files) {
  t.ok(err, 'got second error')
})
