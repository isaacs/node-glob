// https://github.com/isaacs/node-glob/issues/592
// ignore patterns starting with / start at the same place as
// non-ignored patterns starting with /

import { resolve } from 'path'
import { PathScurry, PathScurryPosix, PathScurryWin32 } from 'path-scurry'
import t from 'tap'
import { glob, globSync, Ignore } from '../dist/esm/index.js'

t.test('windows, rooted at the drive of the cwd', t => {
  const cwd = new PathScurryWin32('C:\\a\\b').cwd
  const ign = new Ignore(
    ['/exclude/**', '/x'],
    { platform: 'win32', nocase: true },
    cwd,
  )
  const ignored = (p: string) => ign.ignored(cwd.resolve(p))
  const childrenIgnored = (p: string) =>
    ign.childrenIgnored(cwd.resolve(p))
  t.equal(ignored('C:\\exclude'), true)
  t.equal(ignored('C:\\exclude\\y'), true)
  t.equal(childrenIgnored('C:\\exclude'), true)
  t.equal(ignored('C:\\x'), true)
  t.equal(ignored('C:\\x\\y'), false)
  t.equal(ignored('C:\\a\\b\\exclude\\y'), false)
  t.equal(ignored('D:\\exclude\\y'), false)
  t.equal(childrenIgnored('D:\\exclude'), false)
  t.end()
})

t.test('windows, drive and UNC patterns are not changed', t => {
  const cwd = new PathScurryWin32('C:\\a\\b').cwd
  const ign = new Ignore(
    ['D:/exclude/**', '//host/share/x/**', '//?/C:/y/**'],
    { platform: 'win32', nocase: true },
    cwd,
  )
  const ignored = (p: string) => ign.ignored(cwd.resolve(p))
  t.equal(ignored('D:\\exclude\\y'), true)
  t.equal(ignored('C:\\exclude\\y'), false)
  t.equal(ignored('\\\\host\\share\\x\\y'), true)
  t.equal(ignored('C:\\y\\z'), true)
  t.end()
})

t.test('windows, rooted at the root option', t => {
  const cwd = new PathScurryWin32('C:\\a\\b').cwd
  const ign = new Ignore(
    ['/exclude/**'],
    { platform: 'win32', nocase: true, root: 'D:\\r[1]' },
    cwd,
  )
  const ignored = (p: string) => ign.ignored(cwd.resolve(p))
  t.equal(ignored('D:\\r[1]\\exclude\\y'), true)
  t.equal(ignored('C:\\exclude\\y'), false)
  t.end()
})

t.test('posix, without cwd or root, rooted at /', t => {
  const cwd = new PathScurryPosix('/a/b').cwd
  const ign = new Ignore(['/exclude/**', '/'], { platform: 'linux' })
  t.equal(ign.ignored(cwd.resolve('/exclude/y')), true)
  t.equal(ign.ignored(cwd.resolve('/')), true)
  t.equal(ign.ignored(cwd.resolve('/a')), false)
  t.end()
})

t.test('walk with the root option', async t => {
  const cwd = t.testdir({
    r: { x: { a: '' }, y: { a: '' } },
    x: { a: '' },
  })
  const root = resolve(cwd, 'r')
  const opts = { cwd, root, posix: true, ignore: '/x/**' }
  // on windows, posix absolute paths are //?/C:/...
  const expect = [new PathScurry(root).cwd.resolve('y/a').fullpathPosix()]
  t.strictSame(await glob('/*/a', opts), expect)
  t.strictSame(globSync('/*/a', opts), expect)
})

t.test('windowsPathsNoEscape', t => {
  const cwd = new PathScurryWin32('C:\\a\\b').cwd
  for (const o of [
    { windowsPathsNoEscape: true },
    { allowWindowsEscape: false },
  ]) {
    const ign = new Ignore(
      ['C:\\x\\**', '\\y\\*'],
      { platform: 'win32', nocase: true, root: 'D:\\r[1]', ...o },
      cwd,
    )
    const ignored = (p: string) => ign.ignored(cwd.resolve(p))
    t.equal(ignored('C:\\x\\y'), true)
    t.equal(ignored('D:\\r[1]\\y\\z'), true)
    t.equal(ignored('D:\\r1\\y\\z'), false)
  }
  // without it, \ escapes the next char
  const ign = new Ignore(['C:\\x\\**'], { platform: 'win32' }, cwd)
  t.equal(ign.ignored(cwd.resolve('C:\\x\\y')), false)
  t.end()
})
