require("./global-leakage.js")
var logCalled
var console_error = console.error
console.error = function () {
  logCalled = [].slice.call(arguments, 0)
  console.error = console_error
}

var fs = require('fs')
var test = require('tap').test
var glob = require('../')

test('mock fs', function(t) {
  fs.readdir = function(path, cb) {
    process.nextTick(function() {
      cb(new Error('mock fs.readdir error'))
    })
  }
  t.pass('mocked')
  t.end()
})

test('error callback', function(t) {
  glob('*', function(err, res) {
    t.ok(err, 'expecting mock error')
    t.end()
  })
})

test('called console.error for weird error', function (t) {
  // Need a setTimeout, since the console.error happens directly AFTER
  // the emit('error') with the error.
  setTimeout(function () {
    t.has(logCalled, [ 'glob error', { message: 'mock fs.readdir error' } ],
          'got expected error printed to console.error')
    t.end()
  })
})
