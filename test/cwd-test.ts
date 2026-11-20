import { resolve, sep } from 'path'
import { assert, cleanup, describe, test } from 'ubqtest'
import './00-setup.js'
import { fileURLToPath } from 'url'
import { glob } from '../dist/esm/index.js'
const j = (a: string[]) => a.map(s => s.split('/').join(sep))

const origCwd = process.cwd()
process.chdir(fileURLToPath(new URL('./fixtures', import.meta.url)))
cleanup(() => process.chdir(origCwd))

describe('changing cwd and searching for **/d', () => {
  const expect = Object.entries({
    a: new Set(j(['c/d', 'b/c/d'])),
    'a/b': new Set(j(['c/d'])),
    '': new Set(j(['a/b/c/d', 'a/c/d'])),
  })
  for (const [cwd, matches] of expect) {
    test(cwd || '(empty string)', async () => {
      assert.deepEqual(new Set(await glob('**/d', { cwd })), matches)
      if (cwd) {
        assert.deepEqual(
          new Set(await glob('**/d', { cwd: `${cwd}/` })),
          matches,
        )
        assert.deepEqual(
          new Set(await glob('**/d', { cwd: `${cwd}/.` })),
          matches,
        )
        assert.deepEqual(
          new Set(await glob('**/d', { cwd: `${cwd}/./` })),
          matches,
        )
      } else {
        assert.deepEqual(
          new Set(await glob('**/d', { cwd: '.' })),
          matches,
        )
        assert.deepEqual(
          new Set(await glob('**/d', { cwd: './' })),
          matches,
        )
      }
      assert.deepEqual(
        new Set(await glob('**/d', { cwd: resolve(cwd) })),
        matches,
      )
      assert.deepEqual(
        new Set(await glob('**/d', { cwd: `${resolve(cwd)}/` })),
        matches,
      )
      assert.deepEqual(
        new Set(await glob('**/d', { cwd: `${resolve(cwd)}/.` })),
        matches,
      )
      assert.deepEqual(
        new Set(await glob('**/d', { cwd: `${resolve(cwd)}/./` })),
        matches,
      )
    })
  }
})
