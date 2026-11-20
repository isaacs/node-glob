// regression test to make sure that slash-ended patterns
// don't match files when using a different cwd.
import { assert, test } from 'ubqtest'
import { fileURLToPath } from 'url'
import type { GlobOptions } from '../dist/esm/index.js'
import { glob } from '../dist/esm/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const pattern = '../{*.md,test}/'
const expect = ['.']
const cwd = __dirname
const opt: GlobOptions = { cwd }
process.chdir(`${__dirname}/..`)

test('slashes only match directories', async () => {
  assert.deepEqual(glob.globSync(pattern, opt), expect, 'sync test')
  assert.deepEqual(await glob(pattern, opt), expect, 'async test')
})
