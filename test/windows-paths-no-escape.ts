const t = require('tap')
const g = require('../')

const platforms = ['win32', 'posix']
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
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
    const def = new g.Glob(pattern, { noprocess: true })
    const winpath = new g.Glob(pattern, {
      windowsPathsNoEscape: true,
      noprocess: true,
    })
    const winpathLegacy = new g.Glob(pattern, {
      allowWindowsEscape: false,
      noprocess: true,
    })
    const nowinpath = new g.Glob(pattern, {
      windowsPathsNoEscape: false,
      noprocess: true,
    })

    t.strictSame([
      def.pattern,
      nowinpath.pattern,
      winpath.pattern,
      winpathLegacy.pattern,
    ], [
      '/a/b/c/x\\[a-b\\]y\\*',
      '/a/b/c/x\\[a-b\\]y\\*',
      '/a/b/c/x/[a-b/]y/*',
      '/a/b/c/x/[a-b/]y/*',
    ])
    t.end()
  })
}

Object.defineProperty(process, 'platform', originalPlatform)
