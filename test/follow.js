var glob = require('../')
var test = require('tap').test

process.chdir(__dirname + '/fixtures')

if (process.platform === 'win32') {
  require('tap').plan(0, 'skip on windows')
  return
}

test('follow symlinks', async t => {
  var pattern = 'a/symlink/**'
  var syncNoFollow = glob.sync(pattern).sort()
  var syncFollow = glob.sync(pattern, { follow: true }).sort()
  const noFollow = (await glob(pattern)).sort()
  const follow = (await glob(pattern, { follow: true })).sort()
  t.same(follow, syncFollow, 'sync and async follow should match')
  t.same(noFollow, syncNoFollow, 'sync and async noFollow should match')
  const long = 'a/symlink/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c'
  t.not(follow.indexOf(long), -1, 'follow should have long entry')
  t.not(syncFollow.indexOf(long), -1, 'syncFollow should have long entry')
})
