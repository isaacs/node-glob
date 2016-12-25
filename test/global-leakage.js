if (require.main === module) {
  require('tap').pass('ok')
} else {
  var before = Object.keys(global).sort().filter(function (t) {
    return t !== '__coverage__' && t !== '__core-js_shared__'
  }).join(':')
  var assert = require('assert')

  process.on('exit', function () {
    delete global.TAP_Global_Harness
    var after = Object.keys(global).sort().filter(function (t) {
      return t !== '__coverage__' && t !== '__core-js_shared__'
    }).join(':')
    if (after !== before) {
      console.log('- ' + before)
      console.log('+ ' + after)
    }
    assert.equal(before, after)
  })
}
