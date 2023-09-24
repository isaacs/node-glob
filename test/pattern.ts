import { GLOBSTAR } from 'minimatch'
import t from 'tap'
import { MMPattern, Pattern } from '../dist/esm/pattern.js'
import { Glob } from '../dist/esm/index.js'

t.same(
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
    ],
    { platform: 'win32' }
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
  ]
)
t.throws(() => {
  new Pattern([], ['x'], 0, process.platform)
})

t.throws(() => {
  new Pattern(['x'], [], 0, process.platform)
})

t.throws(() => {
  new Pattern(['x'], ['x'], 2, process.platform)
})

t.throws(() => {
  new Pattern(['x'], ['x'], -1, process.platform)
})

t.throws(() => {
  new Pattern(['x', 'x'], ['x', 'x', 'x'], 0, process.platform)
})

const s = new Pattern(['x'], ['x'], 0, process.platform)
const g = new Pattern(
  [GLOBSTAR as unknown as MMPattern],
  ['**'],
  0,
  process.platform
)
const r = new Pattern([/./], ['?'], 0, process.platform)
t.equal(s.isString(), true)
t.equal(g.isString(), false)
t.equal(r.isString(), false)

t.equal(s.isGlobstar(), false)
t.equal(g.isGlobstar(), true)
t.equal(r.isGlobstar(), false)

t.equal(s.isRegExp(), false)
t.equal(g.isRegExp(), false)
t.equal(r.isRegExp(), true)
