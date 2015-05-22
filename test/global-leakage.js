if (require.main === module)
  return require('tap').pass('ok')

var before = Object.keys(global).sort().filter(function (t) {
  return t !== '__coverage__'
}).join(':')
var assert = require('assert')
var glob = require('../')

process.on('exit', function() {
  delete global.TAP_Global_Harness
  var after = Object.keys(global).sort().filter(function (t) {
    return t !== '__coverage__'
  }).join(':')
  if (after !== before) {
    console.log('- ' + before)
    console.log('+ ' + after)
  }
  assert.equal(before, after)
})
