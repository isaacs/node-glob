import { assert, test, testdir } from 'ubqtest'
import './00-setup.js'
import { symlinkSync } from 'fs'
import { fileURLToPath } from 'url'
import { glob } from '../dist/esm/index.js'

const skip = process.platform === 'win32' && 'skip on windows'

process.chdir(fileURLToPath(new URL('./fixtures', import.meta.url)))

test('follow symlinks', { skip }, async () => {
  const pattern = 'a/symlink/**'
  const syncNoFollow = glob.globSync(pattern)
  const syncFollow = glob.globSync(pattern, { follow: true })
  const [noFollow, follow] = await Promise.all([
    glob(pattern),
    glob(pattern, { follow: true }),
  ])
  assert.deepEqual(
    new Set(follow),
    new Set(syncFollow),
    'sync and async follow should match',
  )
  assert.deepEqual(
    new Set(noFollow),
    new Set(syncNoFollow),
    'sync and async noFollow should match',
  )
  var long = 'a/symlink/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c/a/b/c'
  assert(follow.includes(long), 'follow should have long entry')
  assert(syncFollow.includes(long), 'syncFollow should have long entry')
})

test(
  'follow + nodir means no symlinks to dirs in results',
  { skip },
  async () => {
    const pattern = 'dir_baz/**'
    const cwd = testdir({
      dir_baz: {},
      dir_bar: {},
      dir_foo: {
        'foo.txt': 'hello',
      },
    })
    symlinkSync('../dir_bar', `${cwd}/dir_baz/bar`)
    symlinkSync('../dir_foo', `${cwd}/dir_bar/foo`)
    const follow = true
    const nodir = true
    const posix = true
    const syncResult = glob
      .globSync(pattern, { follow, nodir, cwd, posix })
      .sort((a, b) => a.localeCompare(b))
    const asyncResult = (
      await glob(pattern, { follow, nodir, cwd, posix })
    ).sort((a, b) => a.localeCompare(b))
    assert.deepEqual(syncResult, asyncResult)
    assert.deepEqual(syncResult, ['dir_baz/bar/foo/foo.txt'])
  },
)
