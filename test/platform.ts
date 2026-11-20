import { resolve } from 'path'
import { assert, cleanup, mockImport, test } from 'ubqtest'
import './00-setup.js'

import {
  PathScurry,
  PathScurryDarwin,
  PathScurryPosix,
  PathScurryWin32,
} from 'path-scurry'
import { fileURLToPath } from 'url'
import { Minimatch } from 'minimatch'
import { Glob } from '../dist/esm/index.js'
import { Pattern } from '../dist/esm/pattern.js'
import { GlobWalker } from '../dist/esm/walker.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

test('default platform is process.platform', () => {
  const g = new Glob('.', {})
  assert.equal(g.platform, process.platform)
})

test('default linux when not found', async () => {
  const prop = Object.getOwnPropertyDescriptor(process, 'platform')
  if (!prop) throw new Error('no platform?')
  cleanup(() => {
    Object.defineProperty(process, 'platform', prop)
  })
  Object.defineProperty(process, 'platform', {
    value: null,
    configurable: true,
  })
  const { Glob } = (await mockImport(
    () => import('../dist/esm/index.js'),
    [],
  )) as typeof import('../dist/esm/index.js')
  const g = new Glob('.', {})
  assert.equal(g.platform, 'linux')
})

test('set platform, get appropriate scurry object', () => {
  assert.equal(
    new Glob('.', { platform: 'darwin' }).scurry.constructor,
    PathScurryDarwin,
  )
  assert.equal(
    new Glob('.', { platform: 'linux' }).scurry.constructor,
    PathScurryPosix,
  )
  assert.equal(
    new Glob('.', { platform: 'win32' }).scurry.constructor,
    PathScurryWin32,
  )
  assert.equal(new Glob('.', {}).scurry.constructor, PathScurry)
})

test('set scurry, sets nocase and scurry', () => {
  const scurry = new PathScurryWin32('.')
  assert.throws(() => new Glob('.', { scurry, nocase: false }), Error)
  const g = new Glob('.', { scurry })
  assert.equal(g.scurry, scurry)
  assert.equal(g.nocase, true)
})

test('instantiate to hit a coverage line', async () => {
  const s = new PathScurry(resolve(__dirname, 'fixtures/a/b'))
  const [row] = new Minimatch('?/?').set
  const p = new Pattern(row!, ['?', '?'], 0, process.platform)
  new GlobWalker([p], s.cwd, {
    platform: 'win32',
  })
  new GlobWalker([p], s.cwd, {
    platform: 'linux',
  })
  assert(true, 'this is fine')
})
