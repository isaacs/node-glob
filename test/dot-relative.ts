import { resolve, sep } from 'path'
import { assert, describe, test } from 'ubqtest'
import './00-setup.js'
import { fileURLToPath } from 'url'
import { Glob } from '../dist/esm/index.js'
import { bashResults } from './bash-results.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const pattern = 'a/b/**'
process.chdir(fileURLToPath(new URL('./fixtures', import.meta.url)))

const marks = [true, false]
for (const mark of marks) {
  describe(`'mark=${mark}`, () => {
    test('Emits relative matches prefixed with ./', async () => {
      const g = new Glob(pattern, { dotRelative: true })
      const results = await g.walk()

      assert.equal(
        results.length,
        bashResults[pattern]!.length,
        'must match all files',
      )
      for (const m of results) {
        assert(m.startsWith(`.${sep}`))
      }
    })

    test('returns ./ prefixed matches synchronously', async () => {
      const g = new Glob(pattern, { dotRelative: true })
      const results = g.walkSync()

      assert.equal(
        results.length,
        bashResults[pattern]!.length,
        'must match all files',
      )
      for (const m of results) {
        assert(m.startsWith(`.${sep}`))
      }
    })

    test('does not prefix with ./ unless dotRelative is true', async () => {
      const g = new Glob(pattern, {})
      const results = await g.walk()

      assert.equal(
        results.length,
        bashResults[pattern]!.length,
        'must match all files',
      )
      for (const m of results) {
        assert((mark && m === `.${sep}`) || !m.startsWith(`.${sep}`))
      }
    })
  })
}

describe('does not add ./ for patterns starting in ../', () => {
  const pattern = '../a/b/**'
  const cwd = resolve(__dirname, 'fixtures/a')
  test('async', async () => {
    const g = new Glob(pattern, { dotRelative: true, cwd })
    for await (const m of g) {
      assert(!m.startsWith(`.${sep}..${sep}`))
    }
  })
  test('sync', async () => {
    const g = new Glob(pattern, { dotRelative: true, cwd })
    for (const m of g) {
      assert(!m.startsWith(`.${sep}..${sep}`))
    }
  })
})
