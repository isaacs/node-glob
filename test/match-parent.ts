import { assert, test } from 'ubqtest'
import { PathScurry } from 'path-scurry'
import { Glob } from '../dist/esm/index.js'

const scurry = new PathScurry()
test('/', () => {
  const g = new Glob('/', { withFileTypes: true, scurry })
  const m = g.walkSync()
  assert.equal(m.length, 1)
  assert.equal(m[0], scurry.cwd.resolve('/'))
})
test('/..', () => {
  const g = new Glob('/..', { withFileTypes: true, scurry })
  const m = g.walkSync()
  assert.equal(m.length, 1)
  assert.equal(m[0], scurry.cwd.resolve('/'))
})
test('/../../../../../', () => {
  const g = new Glob('/../../../../../', { withFileTypes: true, scurry })
  const m = g.walkSync()
  assert.equal(m.length, 1)
  assert.equal(m[0], scurry.cwd.resolve('/'))
})
