// regression test to make sure that slash-ended patterns
// don't match files when using a different cwd.
import t from 'tap'
import { glob } from '../'
import type { GlobOptions } from '../src/index.js'

const pattern = '../{*.md,test}/'
const expect = ['.']
const cwd = __dirname
const opt: GlobOptions = { cwd }
process.chdir(__dirname + '/..')

t.test('slashes only match directories', async t => {
  t.same(glob.globSync(pattern, opt), expect, 'sync test')
  t.same(await glob(pattern, opt), expect, 'async test')
})
