import * as fs from 'fs'
import { resolve } from 'path'
import t from 'tap'
import { fileURLToPath } from 'url'
import {
  glob,
  globStream,
  globStreamSync,
  globSync,
} from '../dist/esm/index.js'

const mocks = (ac: AbortController) => ({
  fs: {
    ...fs,
    readdirSync: (path: string, options: any) => {
      ac.abort(yeet)
      return fs.readdirSync(path, options)
    },
  },
})

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const cwd = resolve(__dirname, 'fixtures/a')

const yeet = new Error('yeet')

t.test('pre abort walk', async t => {
  const ac = new AbortController()
  ac.abort(yeet)
  await t.rejects(glob('./**', { cwd, signal: ac.signal }), yeet)
})

t.test('mid-abort walk', async t => {
  const ac = new AbortController()
  const res = glob('./**', { cwd, signal: ac.signal })
  ac.abort(yeet)
  await t.rejects(res, yeet)
})

t.test('pre abort sync walk', t => {
  const ac = new AbortController()
  ac.abort(yeet)
  t.throws(() => globSync('./**', { cwd, signal: ac.signal }))
  t.end()
})

t.test('mid-abort sync walk', async t => {
  const ac = new AbortController()
  const { globSync } = await t.mockImport(
    '../dist/esm/index.js',
    mocks(ac),
  )
  t.throws(() => globSync('./**', { cwd, signal: ac.signal }))
})

t.test('pre abort stream', t => {
  const ac = new AbortController()
  ac.abort(yeet)
  const s = globStream('./**', { cwd, signal: ac.signal })
  s.on('error', er => {
    t.equal(er, yeet)
    t.end()
  })
})

t.test('mid-abort stream', t => {
  const ac = new AbortController()
  const s = globStream('./**', { cwd, signal: ac.signal })
  s.on('error', er => {
    t.equal(er, yeet)
    t.end()
  })
  s.once('data', () => ac.abort(yeet))
})

t.test('pre abort sync stream', t => {
  const ac = new AbortController()
  ac.abort(yeet)
  const s = globStreamSync('./**', { cwd, signal: ac.signal })
  s.on('error', er => {
    t.equal(er, yeet)
    t.end()
  })
})

t.test('mid-abort sync stream', t => {
  const ac = new AbortController()
  const s = globStreamSync('./**', { cwd, signal: ac.signal })
  s.on('error', er => {
    t.equal(er, yeet)
    t.end()
  })
  s.on('data', () => ac.abort(yeet))
})

t.test('no more reads after abort', async t => {
  const mk = (n: number): Record<string, any> =>
    n ? { a: mk(n - 1), b: mk(n - 1), f: '' } : { f: '' }
  const cwd = t.testdir(mk(5))
  const counted = (ac: AbortController) => {
    const c = { calls: 0 }
    const abortFirst = () => {
      if (++c.calls === 1) ac.abort(yeet)
    }
    const cfs = {
      ...fs,
      readdir: (...args: any[]) => {
        abortFirst()
        return (fs.readdir as any)(...args)
      },
      readdirSync: (...args: any[]) => {
        abortFirst()
        return (fs.readdirSync as any)(...args)
      },
    }
    return { c, cfs }
  }

  t.test('async', async t => {
    const ac = new AbortController()
    const { c, cfs } = counted(ac)
    await t.rejects(glob('**', { cwd, signal: ac.signal, fs: cfs }), yeet)
    const atReject = c.calls
    await new Promise(r => setTimeout(r, 100))
    t.equal(c.calls, atReject)
  })

  t.test('sync stream', t => {
    const ac = new AbortController()
    const { c, cfs } = counted(ac)
    const s = globStreamSync('**', { cwd, signal: ac.signal, fs: cfs })
    s.on('error', er => {
      t.equal(er, yeet)
      t.equal(c.calls, 1)
      t.end()
    })
    s.resume()
  })
})
