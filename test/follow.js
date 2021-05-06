var glob = require('../')
var test = require('tap').test

process.chdir(__dirname + '/fixtures')

if (process.platform === 'win32') {
  require('tap').plan(0, 'skip on windows')
  return
}

test('follow symlinks', function (t) {
  var pattern = 'a/symlink/**'
  var syncNoFollow = glob.sync(pattern).sort()
  var syncFollow = glob.sync(pattern, { follow: true }).sort()
  glob(pattern, function (er, res) {
    if (er)
      throw er
    var noFollow = res.sort()
    glob(pattern, { follow: true }, function (er, res) {
      if (er)
        throw er
      var follow = res.sort()

      t.same(follow, syncFollow, 'sync and async follow should match')
      t.same(noFollow, syncNoFollow, 'sync and async noFollow should match')
      var long = 'a/symlink/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c'
      t.not(follow.indexOf(long), -1, 'follow should have long entry')
      t.not(syncFollow.indexOf(long), -1, 'syncFollow should have long entry')
      t.end()
    })
  })
})
