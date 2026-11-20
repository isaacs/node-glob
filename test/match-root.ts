import { assert, test } from 'ubqtest'
import { PathScurry } from 'path-scurry'
import { Glob } from '../dist/esm/index.js'

test('a pattern of / matches the root', () => {
  const scurry = new PathScurry()
  const g = new Glob('/', { withFileTypes: true, scurry })
  const m = g.walkSync()
  assert.equal(m.length, 1)
  assert.equal(m[0], scurry.cwd.resolve('/'))
})
