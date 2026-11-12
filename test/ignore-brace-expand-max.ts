// GHSA-qxr8-q827-836c
// ignore patterns must get the same braceExpandMax limit as
// regular patterns, and the root used for absolute ignore patterns
// must not be brace-expanded.

import { PathScurryPosix } from 'path-scurry'
import t from 'tap'
import { glob, globSync, Ignore } from '../src/index.js'

// 14 '**/..' groups -> 2^14 = 16384 rows, over the 10_000 limit
const payload = Array.from({ length: 14 })
  .map((_, i) => `**/../x${i}/y${i}`)
  .join('/')

t.test('amplified ignore pattern is rejected like a pattern', async t => {
  const cwd = new PathScurryPosix('/p').cwd
  t.throws(() => globSync(payload, { cwd: '/p', platform: 'linux' }), {
    name: 'RangeError',
  })
  const start = performance.now()
  t.throws(() => new Ignore([payload], { platform: 'linux' }, cwd), {
    name: 'RangeError',
  })
  t.throws(
    () =>
      globSync('*', { cwd: '/p', ignore: [payload], platform: 'linux' }),
    { name: 'RangeError' },
  )
  await t.rejects(
    glob('*', { cwd: '/p', ignore: [payload], platform: 'linux' }),
    { name: 'RangeError' },
  )
  t.ok(performance.now() - start < 1000, 'rejected quickly')
})

t.test('brace-expanded ignore is limited to 10_000 by default', t => {
  const cwd = new PathScurryPosix('/p').cwd
  // 5^6 = 15625 brace expansions
  const braces = '{a,b,c,d,e}'.repeat(6)
  const ign = new Ignore([braces], { platform: 'linux' }, cwd)
  t.ok(ign.relative.length <= 10_000)
  t.end()
})

t.test('user-supplied braceExpandMax is honored for ignore', t => {
  const cwd = new PathScurryPosix('/p').cwd
  const ign = new Ignore(
    ['{a,b,c,d,e}'.repeat(3)],
    { platform: 'linux', braceExpandMax: 10 },
    cwd,
  )
  t.ok(ign.relative.length <= 10)
  t.end()
})

t.test('braces in root are literal for absolute ignores', t => {
  const cwd = new PathScurryPosix('/root{7,8}').cwd
  const ign = new Ignore(
    ['/skip.log'],
    { platform: 'linux', root: '/root{7,8}' },
    cwd,
  )
  t.equal(ign.absolute.length, 1)
  t.equal(ign.ignored(cwd.resolve('/root{7,8}/skip.log')), true)
  t.equal(ign.ignored(cwd.resolve('/root7/skip.log')), false)
  t.equal(ign.ignored(cwd.resolve('/root8/skip.log')), false)
  t.end()
})
