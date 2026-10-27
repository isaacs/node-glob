import t from 'tap'
import { glob, globSync } from '../dist/esm/index.js'

// é as one code point, and as e and a combining accent
const nfc = 'é'
const nfd = 'é'

const cwd = t.testdir({
  [`caf${nfd}.txt`]: '',
  'other.txt': '',
})

t.test('a portion with magic', async t => {
  const pattern = `caf${nfc}*`
  t.strictSame(globSync(pattern, { cwd }), [])
  t.strictSame(await glob(pattern, { cwd }), [])
  // the results are the names as they are on disk
  t.strictSame(globSync(pattern, { cwd, normalize: true }), [
    `caf${nfd}.txt`,
  ])
  t.strictSame(await glob(pattern, { cwd, normalize: 'NFD' }), [
    `caf${nfd}.txt`,
  ])
})

t.test('ignore patterns', async t => {
  const ignore = `caf${nfc}*`
  const sort = (r: string[]) => r.sort((a, b) => a.localeCompare(b, 'en'))
  t.strictSame(sort(globSync('*.txt', { cwd, ignore })), [
    `caf${nfd}.txt`,
    'other.txt',
  ])
  t.strictSame(sort(globSync('*.txt', { cwd, ignore, normalize: true })), [
    'other.txt',
  ])
  t.strictSame(
    sort(await glob('*.txt', { cwd, ignore, normalize: true })),
    ['other.txt'],
  )
})
