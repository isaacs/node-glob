import t from 'tap'
import { fileURLToPath } from 'url'
import { Glob } from '../dist/esm/index.js'
const cwd = fileURLToPath(
  new URL('./fixtures/does-not-exist', import.meta.url)
)

t.test('walk', async t => {
  const g = new Glob('**', { cwd })
  t.same(await g.walk(), [])
})

t.test('walkSync', t => {
  const g = new Glob('**', { cwd })
  t.same(g.walkSync(), [])
  t.end()
})

t.test('stream', async t => {
  const g = new Glob('**', { cwd })
  const s = g.stream()
  s.on('data', () => t.fail('should not get entries'))
  t.same(await s.collect(), [])
})

t.test('streamSync', t => {
  const g = new Glob('**', { cwd })
  const s = g.streamSync()
  const c: string[] = []
  s.on('data', p => {
    t.fail('should not get entries')
    c.push(p)
  })
  s.on('end', () => {
    t.same(c, [])
    t.end()
  })
})

t.test('iterate', async t => {
  const g = new Glob('**', { cwd })
  const s = g.iterate()
  const c: string[] = []
  for await (const p of s) {
    c.push(p)
    t.fail('should not get entries')
  }
  t.same(c, [])
})

t.test('iterateSync', async t => {
  const g = new Glob('**', { cwd })
  const s = g.iterateSync()
  const c: string[] = []
  for (const p of s) {
    c.push(p)
    t.fail('should not get entries')
  }
  t.same(c, [])
  t.end()
})

t.test('for await', async t => {
  const g = new Glob('**', { cwd })
  const c: string[] = []
  for await (const p of g) {
    c.push(p)
    t.fail('should not get entries')
  }
  t.same(c, [])
})

t.test('iterateSync', async t => {
  const g = new Glob('**', { cwd })
  const c: string[] = []
  for (const p of g) {
    c.push(p)
    t.fail('should not get entries')
  }
  t.same(c, [])
  t.end()
})
