require("./global-leakage.js")

var fs = require('fs')
var test = require('tap').test
var glob = require('../')

var logCalled

var expectError = function() {
  var console_error = console.error
  var fs_readdir = fs.readdir

  fs.readdir = function(path, cb) {
    process.nextTick(function() {
      cb(new Error('mock fs.readdir error'))
    })
  }

  console.error = function () {
    logCalled = [].slice.call(arguments, 0)
    console.error = console_error
    fs.readdir = fs_readdir
  }
}


test('then fulfilled promise - then/catch/then', function(t) {
  glob('*')
  .then(function(res) {
    t.ok(res, 'expecting result')
    return true
  })
  .catch(function(err) {
    t.fail('not expecting error')
    return false
  })
  .then(function(res) {
    t.ok(res, 'expecting success path')
    t.end()
  })
})

test('catch fulfilled promise - catch/then/then', function(t) {
  glob('*')
  .catch(function(err) {
    t.fail('not expecting error')
    return false
  })
  .then(function(res) {
    t.ok(res, 'expecting result')
    return true
  })
  .then(function(res) {
    t.ok(res, 'expecting success path')
    t.end()
  })
})

test('rejected promise - catch/then', function(t) {
  
  expectError(t)

  glob('*')
  .catch(function(err) {
    t.ok(err, 'expecting error')
    
    return false
  })
  .then(function(res) {
    t.notOk(res, 'expecting error path')
    t.end()
  })
})

test('rejected promise - then/catch/then', function(t) {

  expectError(t)

  glob('*')
  .then(function(res) {
    t.fail('not expecting result')
    return true
  })
  .catch(function(err) {
    t.ok(err, 'expecting error')
    
    return false
  })
  .then(function(res) {
    t.notOk(res, 'expecting error path')
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
