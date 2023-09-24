import t from 'tap'
import { Glob } from '../dist/esm/index.js'

const platforms = ['win32', 'posix']
const originalPlatform = Object.getOwnPropertyDescriptor(
  process,
  'platform'
) as PropertyDescriptor
t.teardown(() => {
  Object.defineProperty(process, 'platform', originalPlatform)
})

for (const p of platforms) {
  t.test(p, t => {
    Object.defineProperty(process, 'platform', {
      value: p,
      enumerable: true,
      configurable: true,
      writable: true,
    })
    t.equal(process.platform, p, 'gut check: actually set platform')
    const pattern = '/a/b/c/x\\[a-b\\]y\\*'
    const def = new Glob(pattern, {})
    const winpath = new Glob(pattern, {
      windowsPathsNoEscape: true,
    })
    const winpathLegacy = new Glob(pattern, {
      allowWindowsEscape: false,
    })
    const nowinpath = new Glob(pattern, {
      windowsPathsNoEscape: false,
    })

    t.strictSame(
      [
        def.pattern,
        nowinpath.pattern,
        winpath.pattern,
        winpathLegacy.pattern,
      ],
      [
        ['/a/b/c/x\\[a-b\\]y\\*'],
        ['/a/b/c/x\\[a-b\\]y\\*'],
        ['/a/b/c/x/[a-b/]y/*'],
        ['/a/b/c/x/[a-b/]y/*'],
      ]
    )
    t.end()
  })
}

Object.defineProperty(process, 'platform', originalPlatform)
