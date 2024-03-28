import t from 'tap'
import { fileURLToPath } from 'url'
import { glob } from '../dist/esm/index.js'

if (process.platform === 'win32') {
  t.plan(0, 'skip on windows')
  process.exit(0)
}

process.chdir(fileURLToPath(new URL('./fixtures', import.meta.url)))

t.test('follow symlinks', async t => {
  const pattern = 'a/symlink/**'
  const syncNoFollow = glob.globSync(pattern)
  const syncFollow = glob.globSync(pattern, { follow: true })
  const [noFollow, follow] = await Promise.all([
    glob(pattern),
    glob(pattern, { follow: true }),
  ])
  t.same(
    new Set(follow),
    new Set(syncFollow),
    'sync and async follow should match'
  )
  t.same(
    new Set(noFollow),
    new Set(syncNoFollow),
    'sync and async noFollow should match'
  )
  var long = 'a/symlink/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c'
  t.ok(follow.includes(long), 'follow should have long entry')
  t.ok(syncFollow.includes(long), 'syncFollow should have long entry')
  t.end()
})

t.test('follow + nodir means no symlinks to dirs in results', async t => {
  const pattern = 'dir_baz/**'
  const cwd = t.testdir({
    dir_baz: {
      bar: t.fixture('symlink', '../dir_bar'),
    },
    dir_bar: {
      foo: t.fixture('symlink', '../dir_foo'),
    },
    dir_foo: {
      'foo.txt': 'hello',
    },
  })
  const follow = true
  const nodir = true
  const posix = true
  const syncResult = glob
    .globSync(pattern, { follow, nodir, cwd, posix })
    .sort((a, b) => a.localeCompare(b))
  const asyncResult = (
    await glob(pattern, { follow, nodir, cwd, posix })
  ).sort((a, b) => a.localeCompare(b))
  t.strictSame(syncResult, asyncResult)
  t.strictSame(syncResult, ['dir_baz/bar/foo/foo.txt'])
})
