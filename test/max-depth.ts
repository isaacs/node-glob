import { resolve } from 'path'
import { PathScurry } from 'path-scurry'
import { assert, test } from 'ubqtest'
import './00-setup.js'
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
test('set maxDepth', async () => {
  const maxDepth = 2
  const cwd = resolve(
    fileURLToPath(new URL('./fixtures', import.meta.url)),
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
      .map(p => p.relative() || '.'),
  )

  const ssync = j(syncRes.map(p => p.relative() || '.'))
  const sasync = j(asyncRes.map(p => p.relative() || '.'))
  assert.deepEqual(ssync, expect, 'got all results sync')
  assert.deepEqual(sasync, expect, 'got all results async')
  for (const p of syncRes) {
    assert(
      p.depth() <= startDepth + maxDepth,
      `does not exceed maxDepth (sync): ${p.relative()} depth=${p.depth()} max=${startDepth + maxDepth}`,
    )
  }
  for (const p of asyncRes) {
    assert(
      p.depth() <= startDepth + maxDepth,
      `does not exceed maxDepth (async): ${p.relative()} depth=${p.depth()} max=${startDepth + maxDepth}`,
    )
  }

  assert.deepEqual(
    j(
      await globStream(pattern, { cwd, maxDepth, follow: true }).collect(),
    ),
    expect,
    'maxDepth with stream',
  )
  assert.deepEqual(
    j(
      await globStreamSync(pattern, {
        cwd,
        maxDepth,
        follow: true,
      }).collect(),
    ),
    expect,
    'maxDepth with streamSync',
  )

  assert.deepEqual(
    await glob(pattern, { cwd, maxDepth: -1, follow: true }),
    [],
    'async maxDepth -1',
  )
  assert.deepEqual(
    globSync(pattern, { cwd, maxDepth: -1, follow: true }),
    [],
    'sync maxDepth -1',
  )

  assert.deepEqual(
    await glob(pattern, { cwd, maxDepth: 0, follow: true }),
    ['.'],
    'async maxDepth 0',
  )
  assert.deepEqual(
    globSync(pattern, { cwd, maxDepth: 0, follow: true }),
    ['.'],
    'async maxDepth 0',
  )

  const g = new Glob(pattern, { cwd, follow: true, maxDepth })
  assert.deepEqual(j([...g]), expect, 'maxDepth with iteration')
  const ai = new Glob(pattern, g)
  const aires: string[] = []
  for await (const res of ai) {
    aires.push(res)
  }
  assert.deepEqual(j(aires), expect, 'maxDepth with async iteration')
})
