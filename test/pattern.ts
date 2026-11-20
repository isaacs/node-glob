import { GLOBSTAR, Minimatch } from 'minimatch'
import { assert, test } from 'ubqtest'
import type { MMPattern } from '../dist/esm/pattern.js'
import { Pattern } from '../dist/esm/pattern.js'
import { Glob } from '../dist/esm/index.js'
import { inspect } from 'node:util'

test('Pattern objects of a Glob', () => {
  assert.deepEqual(
    new Glob(
      [
        '//host/share///x/*',
        '//host/share/',
        '//host/share',
        '//?/z:/x/*',
        '//?/z:/',
        '//?/z:',
        'c:/x/*',
        'c:/',
        '//?/UNC/host/share/x/*',
        '//?/unc/host/share/',
        '//?/UNC/host/share',
      ],
      { platform: 'win32' },
    ).patterns.map(p => [p.globString(), p.root()]),
    [
      ['//host/share/x/*', '//host/share/'],
      ['//host/share/', '//host/share/'],
      ['//host/share/', '//host/share/'],
      ['//?/z:/x/*', '//?/z:/'],
      ['//?/z:/', '//?/z:/'],
      ['//?/z:/', '//?/z:/'],
      ['c:/x/*', 'c:/'],
      ['c:/', 'c:/'],
      ['//?/UNC/host/share/x/*', '//?/UNC/host/share/'],
      ['//?/unc/host/share/', '//?/UNC/host/share/'],
      ['//?/UNC/host/share/', '//?/UNC/host/share/'],
    ],
  )
  assert.throws(() => {
    new Pattern([], ['x'], 0, process.platform)
  }, Error)

  const p = new Pattern(
    ['A', 'B', 'C', 'D'],
    ['a', 'b', 'c', 'd'],
    1,
    process.platform,
  )
  assert.equal(inspect(p), 'Pattern <b/c/d>')

  assert.throws(() => {
    new Pattern(['x'], [], 0, process.platform)
  }, Error)

  assert.throws(() => {
    new Pattern(['x'], ['x'], 2, process.platform)
  }, Error)

  assert.throws(() => {
    new Pattern(['x'], ['x'], -1, process.platform)
  }, Error)

  assert.throws(() => {
    new Pattern(['x', 'x'], ['x', 'x', 'x'], 0, process.platform)
  }, Error)

  const s = new Pattern(['x'], ['x'], 0, process.platform)
  const g = new Pattern(
    [GLOBSTAR as unknown as MMPattern],
    ['**'],
    0,
    process.platform,
  )
  // the Matcher that minimatch makes for a portion with magic
  const matcher = new Minimatch('?').set[0]![0]!
  const r = new Pattern([matcher], ['?'], 0, process.platform)
  assert.snapshot(inspect(s), 's')
  assert.snapshot(inspect(r), 'r')
  assert.snapshot(inspect(g), 'g')
  assert.equal(s.isString(), true)
  assert.equal(g.isString(), false)
  assert.equal(r.isString(), false)

  assert.equal(s.isGlobstar(), false)
  assert.equal(g.isGlobstar(), true)
  assert.equal(r.isGlobstar(), false)

  assert.equal(s.isMatcher(), false)
  assert.equal(g.isMatcher(), false)
  assert.equal(r.isMatcher(), true)
})
