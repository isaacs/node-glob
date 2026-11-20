// GHSA-qxr8-q827-836c
// ignore patterns must get the same braceExpandMax limit as
// regular patterns, and the root used for absolute ignore patterns
// must not be brace-expanded.

import { PathScurryPosix } from 'path-scurry'
import { assert, test } from 'ubqtest'
import { glob, globSync, Ignore } from '../src/index.js'

// 14 '**/..' groups -> 2^14 = 16384 rows, over the 10_000 limit
const payload = Array.from({ length: 14 })
  .map((_, i) => `**/../x${i}/y${i}`)
  .join('/')

test('amplified ignore pattern is rejected like a pattern', async () => {
  const cwd = new PathScurryPosix('/p').cwd
  assert.throws(
    () => globSync(payload, { cwd: '/p', platform: 'linux' }),
    {
      name: 'RangeError',
    },
  )
  const start = performance.now()
  assert.throws(() => new Ignore([payload], { platform: 'linux' }, cwd), {
    name: 'RangeError',
  })
  assert.throws(
    () =>
      globSync('*', { cwd: '/p', ignore: [payload], platform: 'linux' }),
    { name: 'RangeError' },
  )
  await assert.rejects(
    glob('*', { cwd: '/p', ignore: [payload], platform: 'linux' }),
    { name: 'RangeError' },
  )
  assert(performance.now() - start < 1000, 'rejected quickly')
})

test('brace-expanded ignore is limited to 10_000 by default', () => {
  const cwd = new PathScurryPosix('/p').cwd
  // 5^6 = 15625 brace expansions
  const braces = '{a,b,c,d,e}'.repeat(6)
  const ign = new Ignore([braces], { platform: 'linux' }, cwd)
  assert(ign.relative.length <= 10_000)
})

test('user-supplied braceExpandMax is honored for ignore', () => {
  const cwd = new PathScurryPosix('/p').cwd
  const ign = new Ignore(
    ['{a,b,c,d,e}'.repeat(3)],
    { platform: 'linux', braceExpandMax: 10 },
    cwd,
  )
  assert(ign.relative.length <= 10)
})

test('braces in root are literal for absolute ignores', () => {
  const cwd = new PathScurryPosix('/root{7,8}').cwd
  const ign = new Ignore(
    ['/skip.log'],
    { platform: 'linux', root: '/root{7,8}' },
    cwd,
  )
  assert.equal(ign.absolute.length, 1)
  assert.equal(ign.ignored(cwd.resolve('/root{7,8}/skip.log')), true)
  assert.equal(ign.ignored(cwd.resolve('/root7/skip.log')), false)
  assert.equal(ign.ignored(cwd.resolve('/root8/skip.log')), false)
})
