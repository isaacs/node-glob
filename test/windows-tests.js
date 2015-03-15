require('./global-leakage.js')

var os = require('os')
var path = require('path')
var glob = require('../glob.js')
var test = require('tap').test

if (process.platform !== 'win32') {
  console.log('Skipping Windows-specific tests')
  return
}

var uncRoot = '\\\\' + os.hostname() + '\\glob-test'

test('glob doesn\'t choke on UNC paths', function(t) {
  var expect = [uncRoot + '\\c', uncRoot + '\\cb']

  var results = glob(uncRoot + '\\c*', function (er, results) {
    if (er)
      throw er

    t.same(results, expect)
    t.end()
  })
})

test('can match abs paths on Windows with nocase', function(t) {
  var testPath = path.resolve(__dirname, "a")
  glob(testPath, {nocase: true}, function (err, match) {
    t.same(match, [testPath])
    t.end()
  })
})
