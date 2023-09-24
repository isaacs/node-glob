import { resolve } from 'path'
import { PathScurry } from 'path-scurry'
import t from 'tap'
import { fileURLToPath } from 'url'
import {
  Glob,
  glob,
  globStream,
  globStreamSync,
  globSync,
} from '../dist/esm/index.js'

const j = (a: string[]) =>
  a
    .map(s => s.replace(/\\/g, '/'))
    .sort((a, b) => a.localeCompare(b, 'en'))
t.test('set maxDepth', async t => {
  const maxDepth = 2
  const cwd = resolve(
    fileURLToPath(new URL('./fixtures', import.meta.url))
  )
  const startDepth = new PathScurry(cwd).cwd.depth()
  const pattern = '{*/*/*/**,*/*/**,**}'
  const asyncRes = await glob(pattern, {
    cwd,
    maxDepth,
    follow: true,
    withFileTypes: true,
  })
  const syncRes = globSync(pattern, {
    cwd,
    maxDepth,
    follow: true,
    withFileTypes: true,
  })
  const noMaxDepth = globSync(pattern, {
    cwd,
    follow: true,
    withFileTypes: true,
  })
  const expect = j(
    noMaxDepth
      .filter(p => p.depth() <= startDepth + maxDepth)
      .map(p => p.relative() || '.')
  )

  const ssync = j(syncRes.map(p => p.relative() || '.'))
  const sasync = j(asyncRes.map(p => p.relative() || '.'))
  t.same(ssync, expect, 'got all results sync')
  t.same(sasync, expect, 'got all results async')
  for (const p of syncRes) {
    t.ok(p.depth() <= startDepth + maxDepth, 'does not exceed maxDepth', {
      max: startDepth + maxDepth,
      actual: p.depth(),
      file: p.relative(),
      results: 'sync',
    })
  }
  for (const p of asyncRes) {
    t.ok(p.depth() <= startDepth + maxDepth, 'does not exceed maxDepth', {
      max: startDepth + maxDepth,
      actual: p.depth(),
      file: p.relative(),
      results: 'async',
    })
  }

  t.same(
    j(
      await globStream(pattern, { cwd, maxDepth, follow: true }).collect()
    ),
    expect,
    'maxDepth with stream'
  )
  t.same(
    j(
      await globStreamSync(pattern, {
        cwd,
        maxDepth,
        follow: true,
      }).collect()
    ),
    expect,
    'maxDepth with streamSync'
  )

  t.same(
    await glob(pattern, { cwd, maxDepth: -1, follow: true }),
    [],
    'async maxDepth -1'
  )
  t.same(
    globSync(pattern, { cwd, maxDepth: -1, follow: true }),
    [],
    'sync maxDepth -1'
  )

  t.same(
    await glob(pattern, { cwd, maxDepth: 0, follow: true }),
    ['.'],
    'async maxDepth 0'
  )
  t.same(
    globSync(pattern, { cwd, maxDepth: 0, follow: true }),
    ['.'],
    'async maxDepth 0'
  )

  const g = new Glob(pattern, { cwd, follow: true, maxDepth })
  t.same(j([...g]), expect, 'maxDepth with iteration')
  const ai = new Glob(pattern, g)
  const aires: string[] = []
  for await (const res of ai) {
    aires.push(res)
  }
  t.same(j(aires), expect, 'maxDepth with async iteration')
})
