import { resolve, sep } from 'path'
import t from 'tap'
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

t.test('stream', t => {
  let sync: boolean = true
  const s = new Glob('./**', { cwd })
  const stream = s.stream()
  const e = new Set(expect)
  stream.on('data', c => {
    t.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  })
  stream.on('end', () => {
    t.equal(e.size, 0, 'saw all entries')
    t.equal(sync, false, 'did not finish in one tick')
    const d = new Glob('./**', s)
    const dream = d.stream()
    const f = new Set(expect)
    dream.on('data', c => {
      t.equal(f.has(c), true, JSON.stringify(c))
      f.delete(c)
    })
    dream.on('end', () => {
      t.equal(f.size, 0, 'saw all entries')
      t.end()
    })
  })
  sync = false
})

t.test('streamSync', t => {
  let sync: boolean = true
  const s = new Glob('./**', { cwd })
  const stream = s.streamSync()
  const e = new Set(expect)
  stream.on('data', c => {
    t.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  })
  stream.on('end', () => {
    t.equal(e.size, 0, 'saw all entries')
    const d = new Glob('./**', s)
    const dream = d.streamSync()
    const f = new Set(expect)
    dream.on('data', c => {
      t.equal(f.has(c), true, JSON.stringify(c))
      f.delete(c)
    })
    dream.on('end', () => {
      t.equal(f.size, 0, 'saw all entries')
      t.equal(sync, true, 'finished synchronously')
      t.end()
    })
  })
  sync = false
})

t.test('iterate', async t => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  for await (const c of s.iterate()) {
    t.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  t.equal(e.size, 0, 'saw all entries')

  const f = new Set(expect)
  const d = new Glob('./**', s)
  for await (const c of d.iterate()) {
    t.equal(f.has(c), true, JSON.stringify(c))
    f.delete(c)
  }
  t.equal(f.size, 0, 'saw all entries')
})

t.test('iterateSync', t => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  for (const c of s.iterateSync()) {
    t.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  t.equal(e.size, 0, 'saw all entries')

  const f = new Set(expect)
  const d = new Glob('./**', s)
  for (const c of d.iterateSync()) {
    t.equal(f.has(c), true, JSON.stringify(c))
    f.delete(c)
  }
  t.equal(f.size, 0, 'saw all entries')
  t.end()
})

t.test('walk', async t => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  const actual = new Set(await s.walk())
  t.same(actual, e)
  const d = new Glob('./**', s)
  const dactual = new Set(await d.walk())
  t.same(dactual, e)
})

t.test('walkSync', t => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  const actual = new Set(s.walkSync())
  t.same(actual, e)
  const d = new Glob('./**', s)
  const dactual = new Set(d.walkSync())
  t.same(dactual, e)
  t.end()
})

t.test('for await', async t => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  for await (const c of s) {
    t.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  t.equal(e.size, 0, 'saw all entries')

  const f = new Set(expect)
  const d = new Glob('./**', s)
  for await (const c of d) {
    t.equal(f.has(c), true, JSON.stringify(c))
    f.delete(c)
  }
  t.equal(f.size, 0, 'saw all entries')
})

t.test('for of', t => {
  const s = new Glob('./**', { cwd })
  const e = new Set(expect)
  for (const c of s) {
    t.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  t.equal(e.size, 0, 'saw all entries')

  const f = new Set(expect)
  const d = new Glob('./**', s)
  for (const c of d) {
    t.equal(f.has(c), true, JSON.stringify(c))
    f.delete(c)
  }
  t.equal(f.size, 0, 'saw all entries')
  t.end()
})

t.test('iterate on main', async t => {
  const s = globIterate('./**', { cwd })
  const e = new Set(expect)
  for await (const c of s) {
    t.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  t.equal(e.size, 0, 'saw all entries')
})

t.test('iterateSync on main', t => {
  const s = globIterateSync('./**', { cwd })
  const e = new Set(expect)
  for (const c of s) {
    t.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  }
  t.equal(e.size, 0, 'saw all entries')
  t.end()
})

t.test('stream on main', t => {
  let sync: boolean = true
  const stream = globStream('./**', { cwd })
  const e = new Set(expect)
  stream.on('data', c => {
    t.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  })
  stream.on('end', () => {
    t.equal(e.size, 0, 'saw all entries')
    t.equal(sync, false, 'did not finish in one tick')
    t.end()
  })
  sync = false
})

t.test('streamSync on main', t => {
  let sync: boolean = true
  const stream = globStreamSync('./**', { cwd })
  const e = new Set(expect)
  stream.on('data', c => {
    t.equal(e.has(c), true, JSON.stringify(c))
    e.delete(c)
  })
  stream.on('end', () => {
    t.equal(e.size, 0, 'saw all entries')
    t.equal(sync, true, 'finished synchronously')
    t.end()
  })
  sync = false
})

t.test('walk on main', async t => {
  const s = glob('./**', { cwd })
  const e = new Set(expect)
  const actual = new Set(await s)
  t.same(actual, e)
})

t.test('walkSync', t => {
  const s = globSync('./**', { cwd })
  const e = new Set(expect)
  const actual = new Set(s)
  t.same(actual, e)
  t.end()
})

t.test('stream paused while reads are pending', async t => {
  const mk = (n: number): Record<string, any> =>
    n ? { a: mk(n - 1), b: mk(n - 1), f: '' } : { f: '' }
  const cwd = t.testdir(mk(5))
  const s = globStream('**', { cwd })
  // do not read until the walk has paused on a full buffer
  await new Promise(r => setTimeout(r, 50))
  const found: string[] = []
  for await (const p of s) found.push(p)
  t.same(new Set(found), new Set(globSync('**', { cwd })))
})
