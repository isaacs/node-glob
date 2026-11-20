// https://github.com/isaacs/node-glob/issues/592
// ignore patterns starting with / start at the same place as
// non-ignored patterns starting with /

import { resolve } from 'path'
import { PathScurry, PathScurryPosix, PathScurryWin32 } from 'path-scurry'
import { assert, test, testdir } from 'ubqtest'
import { glob, globSync, Ignore } from '../dist/esm/index.js'

test('windows, rooted at the drive of the cwd', () => {
  const cwd = new PathScurryWin32('C:\\a\\b').cwd
  const ign = new Ignore(
    ['/exclude/**', '/x'],
    { platform: 'win32', nocase: true },
    cwd,
  )
  const ignored = (p: string) => ign.ignored(cwd.resolve(p))
  const childrenIgnored = (p: string) =>
    ign.childrenIgnored(cwd.resolve(p))
  assert.equal(ignored('C:\\exclude'), true)
  assert.equal(ignored('C:\\exclude\\y'), true)
  assert.equal(childrenIgnored('C:\\exclude'), true)
  assert.equal(ignored('C:\\x'), true)
  assert.equal(ignored('C:\\x\\y'), false)
  assert.equal(ignored('C:\\a\\b\\exclude\\y'), false)
  assert.equal(ignored('D:\\exclude\\y'), false)
  assert.equal(childrenIgnored('D:\\exclude'), false)
})

test('windows, drive and UNC patterns are not changed', () => {
  const cwd = new PathScurryWin32('C:\\a\\b').cwd
  const ign = new Ignore(
    ['D:/exclude/**', '//host/share/x/**', '//?/C:/y/**'],
    { platform: 'win32', nocase: true },
    cwd,
  )
  const ignored = (p: string) => ign.ignored(cwd.resolve(p))
  assert.equal(ignored('D:\\exclude\\y'), true)
  assert.equal(ignored('C:\\exclude\\y'), false)
  assert.equal(ignored('\\\\host\\share\\x\\y'), true)
  assert.equal(ignored('C:\\y\\z'), true)
})

test('windows, rooted at the root option', () => {
  const cwd = new PathScurryWin32('C:\\a\\b').cwd
  const ign = new Ignore(
    ['/exclude/**'],
    { platform: 'win32', nocase: true, root: 'D:\\r[1]' },
    cwd,
  )
  const ignored = (p: string) => ign.ignored(cwd.resolve(p))
  assert.equal(ignored('D:\\r[1]\\exclude\\y'), true)
  assert.equal(ignored('C:\\exclude\\y'), false)
})

test('posix, without cwd or root, rooted at /', () => {
  const cwd = new PathScurryPosix('/a/b').cwd
  const ign = new Ignore(['/exclude/**', '/'], { platform: 'linux' })
  assert.equal(ign.ignored(cwd.resolve('/exclude/y')), true)
  assert.equal(ign.ignored(cwd.resolve('/')), true)
  assert.equal(ign.ignored(cwd.resolve('/a')), false)
})

test('walk with the root option', async () => {
  const cwd = testdir({
    r: { x: { a: '' }, y: { a: '' } },
    x: { a: '' },
  })
  const root = resolve(cwd, 'r')
  const opts = { cwd, root, posix: true, ignore: '/x/**' }
  // on windows, posix absolute paths are //?/C:/...
  const expect = [new PathScurry(root).cwd.resolve('y/a').fullpathPosix()]
  assert.deepEqual(await glob('/*/a', opts), expect)
  assert.deepEqual(globSync('/*/a', opts), expect)
})

test('windowsPathsNoEscape', () => {
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
    assert.equal(ignored('C:\\x\\y'), true)
    assert.equal(ignored('D:\\r[1]\\y\\z'), true)
    assert.equal(ignored('D:\\r1\\y\\z'), false)
  }
  // without it, \ escapes the next char
  const ign = new Ignore(['C:\\x\\**'], { platform: 'win32' }, cwd)
  assert.equal(ign.ignored(cwd.resolve('C:\\x\\y')), false)
})
