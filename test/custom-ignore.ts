import { basename } from 'path'
import { Path } from 'path-scurry'
import t from 'tap'
import { fileURLToPath } from 'url'
import { glob, globSync, IgnoreLike } from '../dist/esm/index.js'

const cwd = fileURLToPath(new URL('./fixtures', import.meta.url))

const j = (a: string[]) =>
  a
    .map(s => s.replace(/\\/g, '/'))
    .sort((a, b) => a.localeCompare(b, 'en'))

t.test('ignore files with long names', async t => {
  const ignore: IgnoreLike = {
    ignored: (p: Path) => p.name.length > 1,
  }
  const syncRes = globSync('**', { cwd, ignore })
  const asyncRes = await glob('**', { cwd, ignore })
  const expect = j(
    globSync('**', { cwd }).filter(p => {
      return basename(p).length === 1 && basename(p) !== '.'
    })
  )
  t.same(j(syncRes), expect)
  t.same(j(asyncRes), expect)
  for (const r of syncRes) {
    if (basename(r).length > 1) t.fail(r)
  }
})

t.test('ignore symlink and abcdef directories', async t => {
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
    })
  )
  t.same(j(syncRes), expect)
  t.same(j(asyncRes), expect)
  for (const r of syncRes) {
    if (r === 'symlink' || r === 'basename') t.fail(r)
  }
})
