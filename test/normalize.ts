import { assert, test, testdir } from 'ubqtest'
import { glob, globSync } from '../dist/esm/index.js'

// é as one code point, and as e and a combining accent
const nfc = 'é'
const nfd = 'é'

const cwd = testdir({
  [`caf${nfd}.txt`]: '',
  'other.txt': '',
})

test('a portion with magic', async () => {
  const pattern = `caf${nfc}*`
  assert.deepEqual(globSync(pattern, { cwd }), [])
  assert.deepEqual(await glob(pattern, { cwd }), [])
  // the results are the names as they are on disk
  assert.deepEqual(globSync(pattern, { cwd, normalize: true }), [
    `caf${nfd}.txt`,
  ])
  assert.deepEqual(await glob(pattern, { cwd, normalize: 'NFD' }), [
    `caf${nfd}.txt`,
  ])
})

test('ignore patterns', async () => {
  const ignore = `caf${nfc}*`
  const sort = (r: string[]) => r.sort((a, b) => a.localeCompare(b, 'en'))
  assert.deepEqual(sort(globSync('*.txt', { cwd, ignore })), [
    `caf${nfd}.txt`,
    'other.txt',
  ])
  assert.deepEqual(
    sort(globSync('*.txt', { cwd, ignore, normalize: true })),
    ['other.txt'],
  )
  assert.deepEqual(
    sort(await glob('*.txt', { cwd, ignore, normalize: true })),
    ['other.txt'],
  )
})
