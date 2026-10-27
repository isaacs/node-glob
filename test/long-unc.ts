// //?/UNC/host/share/x is the same path as //host/share/x on Windows

import * as fs from 'fs'
import { PathScurryWin32 } from 'path-scurry'
import t from 'tap'
import { glob, globSync } from '../dist/esm/index.js'

const dir = t.testdir({
  a: { x: '', y: '' },
  b: { x: '' },
})

// serve \\HOST\SHARE\ from the test dir
const real = (p: string) =>
  p.replace(/^\\\\HOST\\SHARE\\?/i, `${dir}/`).replace(/\\/g, '/')
const winfs = {
  lstatSync: (p: string) => fs.lstatSync(real(p)),
  readdir: (
    p: string,
    o: { withFileTypes: true },
    cb: (er: NodeJS.ErrnoException | null, e?: fs.Dirent[]) => any,
  ) => fs.readdir(real(p), o, cb),
  readdirSync: (p: string, o: { withFileTypes: true }) =>
    fs.readdirSync(real(p), o),
  readlinkSync: (p: string) => fs.readlinkSync(real(p)),
  realpathSync: (p: string) => fs.realpathSync(real(p)),
  promises: {
    lstat: (p: string) => fs.promises.lstat(real(p)),
    readdir: (p: string, o: { withFileTypes: true }) =>
      fs.promises.readdir(real(p), o),
    readlink: (p: string) => fs.promises.readlink(real(p)),
    realpath: (p: string) => fs.promises.realpath(real(p)),
  },
}

// the share is a new root, which uses the same fs as the cwd
const scurry = () => new PathScurryWin32('C:\\', { fs: winfs })

const expect = ['//HOST/SHARE/a/x', '//HOST/SHARE/b/x']
for (const pattern of [
  '//host/share/*/x',
  '//?/UNC/host/share/*/x',
  '//?/unc/HOST/share/*/x',
  '//?/UNC/host/share/a/../*/x',
]) {
  t.test(pattern, async t => {
    const opts = {
      platform: 'win32',
      posix: true,
      scurry: scurry(),
    } as const
    t.strictSame(globSync(pattern, opts).sort(), expect, 'sync')
    t.strictSame((await glob(pattern, opts)).sort(), expect, 'async')
  })
}

t.test('ignore', async t => {
  const opts = {
    platform: 'win32',
    posix: true,
    scurry: scurry(),
    ignore: ['//?/UNC/host/share/a/**'],
  } as const
  t.strictSame(globSync('//host/share/*/x', opts), ['//HOST/SHARE/b/x'])
})
