import * as fs from 'fs'
import { resolve } from 'path'
import { assert, describe, mockImport, test, testdir } from 'ubqtest'
import './00-setup.js'
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
    readdirSync: ((path: string, options: any) => {
      ac.abort(yeet)
      return fs.readdirSync(path, options)
    }) as typeof fs.readdirSync,
  },
})

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const cwd = resolve(__dirname, 'fixtures/a')

const yeet = new Error('yeet')

test('pre abort walk', async () => {
  const ac = new AbortController()
  ac.abort(yeet)
  await assert.rejects(glob('./**', { cwd, signal: ac.signal }), {
    message: yeet.message,
  })
})

test('mid-abort walk', async () => {
  const ac = new AbortController()
  const res = glob('./**', { cwd, signal: ac.signal })
  ac.abort(yeet)
  await assert.rejects(res, { message: yeet.message })
})

test('pre abort sync walk', () => {
  const ac = new AbortController()
  ac.abort(yeet)
  assert.throws(() => globSync('./**', { cwd, signal: ac.signal }), Error)
})

test('mid-abort sync walk', async () => {
  const ac = new AbortController()
  // glob does its fs work in path-scurry, a package in node_modules,
  // so the mock of fs goes to an instance of path-scurry.
  const scurry = await mockImport(
    () => import('path-scurry'),
    [[() => import('fs'), mocks(ac).fs]],
  )
  const { globSync } = await mockImport(
    () => import('../dist/esm/index.js'),
    [[() => import('path-scurry'), scurry]],
  )
  assert.throws(() => globSync('./**', { cwd, signal: ac.signal }), Error)
})

test('pre abort stream', () =>
  new Promise<void>(end => {
    const ac = new AbortController()
    ac.abort(yeet)
    const s = globStream('./**', { cwd, signal: ac.signal })
    s.on('error', er => {
      assert.equal(er, yeet)
      end()
    })
  }))

test('mid-abort stream', () =>
  new Promise<void>(end => {
    const ac = new AbortController()
    const s = globStream('./**', { cwd, signal: ac.signal })
    s.on('error', er => {
      assert.equal(er, yeet)
      end()
    })
    s.once('data', () => ac.abort(yeet))
  }))

test('pre abort sync stream', () =>
  new Promise<void>(end => {
    const ac = new AbortController()
    ac.abort(yeet)
    const s = globStreamSync('./**', { cwd, signal: ac.signal })
    s.on('error', er => {
      assert.equal(er, yeet)
      end()
    })
  }))

test('mid-abort sync stream', () =>
  new Promise<void>(end => {
    const ac = new AbortController()
    const s = globStreamSync('./**', { cwd, signal: ac.signal })
    s.on('error', er => {
      assert.equal(er, yeet)
      end()
    })
    s.on('data', () => ac.abort(yeet))
  }))

describe('no more reads after abort', () => {
  const mk = (n: number): Record<string, any> =>
    n ? { a: mk(n - 1), b: mk(n - 1), f: '' } : { f: '' }
  const cwd = testdir(mk(5))
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

  test('async', async () => {
    const ac = new AbortController()
    const { c, cfs } = counted(ac)
    await assert.rejects(glob('**', { cwd, signal: ac.signal, fs: cfs }), {
      message: yeet.message,
    })
    const atReject = c.calls
    await new Promise(r => setTimeout(r, 100))
    assert.equal(c.calls, atReject)
  })

  test('sync stream', () =>
    new Promise<void>(end => {
      const ac = new AbortController()
      const { c, cfs } = counted(ac)
      const s = globStreamSync('**', { cwd, signal: ac.signal, fs: cfs })
      s.on('error', er => {
        assert.equal(er, yeet)
        assert.equal(c.calls, 1)
        end()
      })
      s.resume()
    }))
})
