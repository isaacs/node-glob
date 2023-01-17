import * as fs from 'fs'
import { Dirent, readdir, readdirSync } from 'fs'
import {resolve} from 'path'
import t from 'tap'
const { glob } = t.mock('../dist/cjs/index.js', {
  fs: {
    ...fs,
    readdir: (
      path: string,
      o: { withFileTypes: true },
      cb: (er: null | NodeJS.ErrnoException, entries?: Dirent[]) => void
    ) => {
      readdir(path, o, (er, entries) => {
        if (entries) {
          cb(
            er,
            entries.sort(({ name: b }, { name: a }) =>
              a.localeCompare(b, 'en')
            )
          )
        } else {
          cb(er)
        }
      })
    },
    readdirSync: (path: string, o: { withFileTypes: true }) =>
      readdirSync(path, o).sort(({ name: b }, { name: a }) =>
        a.localeCompare(b, 'en')
      ),
  },
})

const pattern = 'a/[bz]*'
t.test('nosort', async t => {
  const opt = { nosort: true, cwd: resolve(__dirname, 'fixtures') }
  const expect = ['a/z', 'a/bc', 'a/b']
  t.same(glob.sync(pattern, opt), expect)
  t.same(await glob(pattern, opt), expect)
})

t.test('nosort unset', async t => {
  const opt = { cwd: resolve(__dirname, 'fixtures') }
  const expect = ['a/b', 'a/bc', 'a/z']
  t.same(glob.sync(pattern, opt), expect)
  t.same(await glob(pattern, opt), expect)
})

t.test('nosort:false', async t => {
  const opt = { nosort: false, cwd: resolve(__dirname, 'fixtures') }
  const expect = ['a/b', 'a/bc', 'a/z']
  t.same(glob.sync(pattern, opt), expect)
  t.same(await glob(pattern, opt), expect)
})
