import { resolve, sep } from 'path'
import { assert, test, testdir } from 'ubqtest'
import './00-setup.js'
import { fileURLToPath } from 'url'
import {
  Glob,
  globIterate,
  globIterateSync,
  globStream,
  globStreamSync,
} from '../dist/esm/index.js'
import { glob, globSync } from '../dist/esm/index.js'
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const cwd = resolve(__dirname, 'fixtures/a')
const j = (a: string[]) => a.map(a => a.split('/').join(sep))
const expect = j([
  '.',
  'z',
  'x',
  'cb',
  'c',
  'bc',
  'b',
  'abcfed',
  'abcdef',
  'cb/e',
  'cb/e/f',
  'c/d',
  'c/d/c',
  'c/d/c/b',
  'bc/e',
  'bc/e/f',
  'b/c',
  'b/c/d',
  'abcfed/g',
  'abcfed/g/h',
  'abcdef/g',
  'abcdef/g/h',
  ...(process.platform !== 'win32' ?
    ['symlink', 'symlink/a', 'symlink/a/b', 'symlink/a/b/c']
  : []),
])

test('stream', () =>
  new Promise<void>(done => {
    let sync: boolean = true
    const s = new Glob('./**', { cwd })
    const stream = s.stream()
    const e = new Set(expect)
    stream.on('data', c => {
      assert.equal(e.has(c), true, JSON.stringify(c))
      e.delete(c)
    })
    stream.on('end', () => {
      assert.equal(e.size, 0, 'saw all entries')
      assert.equal(sync, false, 'did not finish in one tick')
      const d = new Glob('./**', s)
      const dream = d.stream()
      const f = new Set(expect)
      dream.on('data', c => {
        assert.equal(f.has(c), true, JSON.stringify(c))
        f.delete(c)
      })
      dream.on('end', () => {
        assert.equal(f.size, 0, 'saw all entries')
        done()
      })
    })
    sync = false
  }))

test('streamSync', () =>
  new Promise<void>(done => {
    let sync: boolean = true
    const s = new Glob('./**', { cwd })
    const stream = s.streamSync()
    const e = new Set(expect)
    stream.on('data', c => {
      assert.equal(e.has(c), true, JSON.stringify(c))
      e.delete(c)
    })
    stream.on('end', () => {
      assert.equal(e.size, 0, 'saw all entries')
      const d = new Glob('./**', s)
      const dream = d.streamSync()
      const f = new Set(expect)
      dream.on('data', c => {
        assert.equal(f.has(c), true, JSON.stringify(c))
        f.delete(c)
      })
      dream.on('end', () => {
        assert.equal(f.size, 0, 'saw all entries')
        assert.equal(sync, true, 'finished synchronously')
        done()
      })
    })
    sync = false
  }))

test('iterate', async () => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  for await (const c of s.iterate()) {
    assert.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  assert.equal(e.size, 0, 'saw all entries')

  const f = new Set(expect)
  const d = new Glob('./**', s)
  for await (const c of d.iterate()) {
    assert.equal(f.has(c), true, JSON.stringify(c))
    f.delete(c)
  }
  assert.equal(f.size, 0, 'saw all entries')
})

test('iterateSync', () => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  for (const c of s.iterateSync()) {
    assert.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  assert.equal(e.size, 0, 'saw all entries')

  const f = new Set(expect)
  const d = new Glob('./**', s)
  for (const c of d.iterateSync()) {
    assert.equal(f.has(c), true, JSON.stringify(c))
    f.delete(c)
  }
  assert.equal(f.size, 0, 'saw all entries')
})

test('walk', async () => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  const actual = new Set(await s.walk())
  assert.deepEqual(actual, e)
  const d = new Glob('./**', s)
  const dactual = new Set(await d.walk())
  assert.deepEqual(dactual, e)
})

test('walkSync', () => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  const actual = new Set(s.walkSync())
  assert.deepEqual(actual, e)
  const d = new Glob('./**', s)
  const dactual = new Set(d.walkSync())
  assert.deepEqual(dactual, e)
})

test('for await', async () => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  for await (const c of s) {
    assert.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  assert.equal(e.size, 0, 'saw all entries')

  const f = new Set(expect)
  const d = new Glob('./**', s)
  for await (const c of d) {
    assert.equal(f.has(c), true, JSON.stringify(c))
    f.delete(c)
  }
  assert.equal(f.size, 0, 'saw all entries')
})

test('for of', () => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  for (const c of s) {
    assert.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  assert.equal(e.size, 0, 'saw all entries')

  const f = new Set(expect)
  const d = new Glob('./**', s)
  for (const c of d) {
    assert.equal(f.has(c), true, JSON.stringify(c))
    f.delete(c)
  }
  assert.equal(f.size, 0, 'saw all entries')
})

test('iterate on main', async () => {
  const s = globIterate('./**', { cwd })
  const e = new Set(expect)
  for await (const c of s) {
    assert.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  assert.equal(e.size, 0, 'saw all entries')
})

test('iterateSync on main', () => {
  const s = globIterateSync('./**', { cwd })
  const e = new Set(expect)
  for (const c of s) {
    assert.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  assert.equal(e.size, 0, 'saw all entries')
})

test('stream on main', () =>
  new Promise<void>(done => {
    let sync: boolean = true
    const stream = globStream('./**', { cwd })
    const e = new Set(expect)
    stream.on('data', c => {
      assert.equal(e.has(c), true, JSON.stringify(c))
      e.delete(c)
    })
    stream.on('end', () => {
      assert.equal(e.size, 0, 'saw all entries')
      assert.equal(sync, false, 'did not finish in one tick')
      done()
    })
    sync = false
  }))

test('streamSync on main', () =>
  new Promise<void>(done => {
    let sync: boolean = true
    const stream = globStreamSync('./**', { cwd })
    const e = new Set(expect)
    stream.on('data', c => {
      assert.equal(e.has(c), true, JSON.stringify(c))
      e.delete(c)
    })
    stream.on('end', () => {
      assert.equal(e.size, 0, 'saw all entries')
      assert.equal(sync, true, 'finished synchronously')
      done()
    })
    sync = false
  }))

test('walk on main', async () => {
  const s = glob('./**', { cwd })
  const e = new Set(expect)
  const actual = new Set(await s)
  assert.deepEqual(actual, e)
})

test('globSync', () => {
  const s = globSync('./**', { cwd })
  const e = new Set(expect)
  const actual = new Set(s)
  assert.deepEqual(actual, e)
})

test('stream paused while reads are pending', async () => {
  const mk = (n: number): Record<string, any> =>
    n ? { a: mk(n - 1), b: mk(n - 1), f: '' } : { f: '' }
  const cwd = testdir(mk(5))
  const s = globStream('**', { cwd })
  // do not read until the walk has paused on a full buffer
  await new Promise(r => setTimeout(r, 50))
  const found: string[] = []
  for await (const p of s) found.push(p)
  assert.deepEqual(new Set(found), new Set(globSync('**', { cwd })))
})
