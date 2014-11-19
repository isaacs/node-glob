if (require.main === module)
  return console.log('ok')

var before = Object.keys(global).concat('TAP_Global_Harness').sort().join(':')
var assert = require('assert')
var glob = require('../')

process.on('exit', function() {
  var after = Object.keys(global).sort().join(':')
  assert.equal(before, after)
})
