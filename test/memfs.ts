import { assert, describe, mockImport, test } from 'ubqtest'
import { fs as memfs, vol } from 'memfs'
import { glob } from '../dist/esm/index.js'

const skip =
  process.platform === 'win32' && 'this test does not work on windows'

const setup = () => vol.fromJSON({ '/x': 'abc' })

const fs = memfs as unknown as typeof import('fs')
const fsp = memfs.promises as unknown as typeof import('fs/promises')

// glob does its fs work in path-scurry, a package in node_modules, so
// the mock of fs goes to an instance of path-scurry.
const mockGlob = async () => {
  const scurry = await mockImport(
    () => import('path-scurry'),
    [
      [() => import('fs'), fs],
      [() => import('node:fs/promises'), fsp],
    ],
  )
  return mockImport(
    () => import('../dist/esm/index.js'),
    [[() => import('path-scurry'), scurry]],
  )
}

const patterns = ['/**/*', '/*', '/x']
const cwds = ['/', undefined]
for (const pattern of patterns) {
  describe(pattern, { skip }, () => {
    for (const cwd of cwds) {
      describe(`cwd=${cwd}`, () => {
        test('mocking the fs', async () => {
          setup()
          const { glob } = await mockGlob()
          assert.deepEqual(await glob(pattern, { nodir: true, cwd }), [
            '/x',
          ])
        })
        test('passing in fs argument', async () => {
          setup()
          assert.deepEqual(await glob(pattern, { nodir: true, cwd, fs }), [
            '/x',
          ])
        })
      })
    }
  })
}
