import { resolve } from 'path'
import t from 'tap'
import {fileURLToPath} from 'url'
import { glob, globSync } from '../dist/esm/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

t.test('stat: true', async t => {
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
  t.type(asyncRes[0]?.mode, 'number')
  t.type(syncRes[0]?.mode, 'number')

  const noStat = await glob(pattern, { cwd, withFileTypes: true })
  t.equal(noStat[0]?.mode, undefined)
})
