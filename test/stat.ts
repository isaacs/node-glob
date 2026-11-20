import { resolve } from 'path'
import { assert, test } from 'ubqtest'
import './00-setup.js'
import { fileURLToPath } from 'url'
import { glob, globSync } from '../dist/esm/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

test('stat: true', async () => {
  const cwd = resolve(__dirname, 'fixtures')
  const pattern = '*'
  const asyncRes = await glob(pattern, {
    cwd,
    withFileTypes: true,
    stat: true,
  })
  const syncRes = globSync(pattern, {
    cwd,
    withFileTypes: true,
    stat: true,
  })
  assert.equal(typeof asyncRes[0]?.mode, 'number')
  assert.equal(typeof syncRes[0]?.mode, 'number')

  const noStat = await glob(pattern, { cwd, withFileTypes: true })
  assert.equal(noStat[0]?.mode, undefined)
})
