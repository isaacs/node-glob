import { basename } from 'path'
import type { Path } from 'path-scurry'
import { assert, test } from 'ubqtest'
import './00-setup.js'
import { fileURLToPath } from 'url'
import type { IgnoreLike } from '../dist/esm/index.js'
import { glob, globSync } from '../dist/esm/index.js'

const cwd = fileURLToPath(new URL('./fixtures', import.meta.url))

const j = (a: string[]) =>
  a
    .map(s => s.replace(/\\/g, '/'))
    .sort((a, b) => a.localeCompare(b, 'en'))

test('ignore files with long names', async () => {
  const ignore: IgnoreLike = {
    ignored: (p: Path) => p.name.length > 1,
  }
  const syncRes = globSync('**', { cwd, ignore })
  const asyncRes = await glob('**', { cwd, ignore })
  const expect = j(
    globSync('**', { cwd }).filter(p => {
      return basename(p).length === 1 && basename(p) !== '.'
    }),
  )
  assert.deepEqual(j(syncRes), expect)
  assert.deepEqual(j(asyncRes), expect)
  assert.deepEqual(
    syncRes.filter(r => basename(r).length > 1),
    [],
  )
})

test('ignore symlink and abcdef directories', async () => {
  const ignore: IgnoreLike = {
    childrenIgnored: (p: Path) => {
      return p.isNamed('symlink') || p.isNamed('abcdef')
    },
  }
  const syncRes = globSync('**', { cwd, ignore, nodir: true })
  const asyncRes = await glob('**', { cwd, ignore, nodir: true })
  const expect = j(
    globSync('**', { nodir: true, cwd }).filter(p => {
      return !/\bsymlink\b|\babcdef\b/.test(p)
    }),
  )
  assert.deepEqual(j(syncRes), expect)
  assert.deepEqual(j(asyncRes), expect)
  assert.deepEqual(
    syncRes.filter(r => r === 'symlink' || r === 'basename'),
    [],
  )
})
