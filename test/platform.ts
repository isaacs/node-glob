import { resolve } from 'path'
import t from 'tap'

import {
  PathScurry,
  PathScurryDarwin,
  PathScurryPosix,
  PathScurryWin32,
} from 'path-scurry'
import { fileURLToPath } from 'url'
import { Glob } from '../dist/esm/index.js'
import { Pattern } from '../dist/esm/pattern.js'
import { GlobWalker } from '../dist/esm/walker.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

t.test('default platform is process.platform', t => {
  const g = new Glob('.', {})
  t.equal(g.platform, process.platform)
  t.end()
})

t.test('default linux when not found', async t => {
  const prop = Object.getOwnPropertyDescriptor(process, 'platform')
  if (!prop) throw new Error('no platform?')
  t.teardown(() => {
    Object.defineProperty(process, 'platform', prop)
  })
  Object.defineProperty(process, 'platform', {
    value: null,
    configurable: true,
  })
  const { Glob } = (await t.mockImport(
    '../dist/esm/index.js',
    {}
  )) as typeof import('../dist/esm/index.js')
  const g = new Glob('.', {})
  t.equal(g.platform, 'linux')
  t.end()
})

t.test('set platform, get appropriate scurry object', t => {
  t.equal(
    new Glob('.', { platform: 'darwin' }).scurry.constructor,
    PathScurryDarwin
  )
  t.equal(
    new Glob('.', { platform: 'linux' }).scurry.constructor,
    PathScurryPosix
  )
  t.equal(
    new Glob('.', { platform: 'win32' }).scurry.constructor,
    PathScurryWin32
  )
  t.equal(new Glob('.', {}).scurry.constructor, PathScurry)
  t.end()
})

t.test('set scurry, sets nocase and scurry', t => {
  const scurry = new PathScurryWin32('.')
  t.throws(() => new Glob('.', { scurry, nocase: false }))
  const g = new Glob('.', { scurry })
  t.equal(g.scurry, scurry)
  t.equal(g.nocase, true)
  t.end()
})

t.test('instantiate to hit a coverage line', async t => {
  const s = new PathScurry(resolve(__dirname, 'fixtures/a/b'))
  const p = new Pattern([/./, /./], ['?', '?'], 0, process.platform)
  new GlobWalker([p], s.cwd, {
    platform: 'win32',
  })
  new GlobWalker([p], s.cwd, {
    platform: 'linux',
  })
  t.pass('this is fine')
})
