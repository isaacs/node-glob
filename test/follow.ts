import t from 'tap'
import { glob } from '../'

if (process.platform === 'win32') {
  t.plan(0, 'skip on windows')
  process.exit(0)
}

process.chdir(__dirname + '/fixtures')

t.test('follow symlinks', async t => {
  const pattern = 'a/symlink/**'
  const syncNoFollow = glob.globSync(pattern)
  const syncFollow = glob.globSync(pattern, { follow: true })
  const [noFollow, follow] = await Promise.all([
    glob(pattern),
    glob(pattern, { follow: true }),
  ])
  t.same(follow, syncFollow, 'sync and async follow should match')
  t.same(noFollow, syncNoFollow, 'sync and async noFollow should match')
  var long = 'a/symlink/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c'
  t.ok(follow.includes(long), 'follow should have long entry')
  t.ok(syncFollow.includes(long), 'syncFollow should have long entry')
  t.end()
})
