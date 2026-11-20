import { assert, test } from 'ubqtest'
import './00-setup.js'
import { fileURLToPath } from 'url'
import { Glob } from '../dist/esm/index.js'
const cwd = fileURLToPath(
  new URL('./fixtures/does-not-exist', import.meta.url),
)

test('walk', async () => {
  const g = new Glob('**', { cwd })
  assert.deepEqual(await g.walk(), [])
})

test('walkSync', () => {
  const g = new Glob('**', { cwd })
  assert.deepEqual(g.walkSync(), [])
})

test('stream', async () => {
  const g = new Glob('**', { cwd })
  const s = g.stream()
  s.on('data', () => assert.fail('should not get entries'))
  assert.deepEqual([...(await s.collect())], [])
})

test('streamSync', () =>
  new Promise<void>(done => {
    const g = new Glob('**', { cwd })
    const s = g.streamSync()
    const c: string[] = []
    s.on('data', p => {
      assert.fail('should not get entries')
      c.push(p)
    })
    s.on('end', () => {
      assert.deepEqual(c, [])
      done()
    })
  }))

test('iterate', async () => {
  const g = new Glob('**', { cwd })
  const s = g.iterate()
  const c: string[] = []
  for await (const p of s) {
    c.push(p)
  }
  assert.deepEqual(c, [])
})

test('iterateSync', async () => {
  const g = new Glob('**', { cwd })
  const s = g.iterateSync()
  const c: string[] = []
  for (const p of s) {
    c.push(p)
  }
  assert.deepEqual(c, [])
})

test('for await', async () => {
  const g = new Glob('**', { cwd })
  const c: string[] = []
  for await (const p of g) {
    c.push(p)
  }
  assert.deepEqual(c, [])
})

test('for of', async () => {
  const g = new Glob('**', { cwd })
  const c: string[] = []
  for (const p of g) {
    c.push(p)
  }
  assert.deepEqual(c, [])
})
