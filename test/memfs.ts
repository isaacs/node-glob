import t from 'tap'

if (process.platform === 'win32') {
  t.plan(0, 'this test does not work on windows')
  process.exit(0)
}

import { fs as memfs, vol } from 'memfs'
import { glob } from '../dist/esm/index.js'

t.beforeEach(() => vol.fromJSON({ '/x': 'abc' }))

const fs = memfs as unknown as typeof import('fs')

const mock = {
  fs: memfs,
  'fs/promises': memfs.promises,
}

const patterns = ['/**/*', '/*', '/x']
const cwds = ['/', undefined]
for (const pattern of patterns) {
  t.test(pattern, async t => {
    for (const cwd of cwds) {
      t.test(`cwd=${cwd}`, async t => {
        t.test('mocking the fs', async t => {
          const { glob } = (await t.mockImport(
            '../dist/esm/index.js',
            mock
        )) as typeof import('../dist/esm/index.js')
          t.strictSame(await glob(pattern, { nodir: true, cwd }), ['/x'])
        })
        t.test('passing in fs argument', async t => {
          t.strictSame(await glob(pattern, { nodir: true, cwd, fs }), [
            '/x',
          ])
        })
      })
    }
  })
}
