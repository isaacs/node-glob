import t from 'tap'
import { Glob } from '../'
const f = __filename.replace(/\\/g, '/')

t.test('new glob, with cb, and no options', async t => {
  const gs = new Glob(f)
  t.same(gs.processSync(), [f])
  const g = new Glob(f)
  t.same(await g.process(), [f])
})
