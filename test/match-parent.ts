import t from 'tap'
import { PathScurry } from 'path-scurry'
import { Glob } from '../dist/esm/index.js'

const scurry = new PathScurry()
t.test('/', t => {
  const g = new Glob('/', { withFileTypes: true, scurry })
  const m = g.walkSync()
  t.equal(m.length, 1)
  t.equal(m[0], scurry.cwd.resolve('/'))
  t.end()
})
t.test('/..', t => {
  const g = new Glob('/..', { withFileTypes: true, scurry })
  const m = g.walkSync()
  t.equal(m.length, 1)
  t.equal(m[0], scurry.cwd.resolve('/'))
  t.end()
})
t.test('/../../../../../', t => {
  const g = new Glob('/../../../../../', { withFileTypes: true, scurry })
  const m = g.walkSync()
  t.equal(m.length, 1)
  t.equal(m[0], scurry.cwd.resolve('/'))
  t.end()
})
