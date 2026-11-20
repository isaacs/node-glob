import { isAbsolute } from 'path'
import { assert, describe, test } from 'ubqtest'
import './00-setup.js'
import { fileURLToPath } from 'url'
import { Glob } from '../dist/esm/index.js'
import { bashResults } from './bash-results.js'

const pattern = 'a/b/**'
const __dirname = fileURLToPath(new URL('.', import.meta.url))
process.chdir(`${__dirname}/fixtures`)

const ok = (file: string) =>
  assert(isAbsolute(file), `must be absolute: ${file}`)

var marks = [true, false]
for (const mark of marks) {
  describe(`mark=${mark}`, () => {
    test('Emits absolute matches if option set', async () => {
      var g = new Glob(pattern, { absolute: true, posix: true })
      const results = await g.walk()

      assert.equal(
        results.length,
        bashResults[pattern]!.length,
        'must match all files',
      )
      for (const m of results) {
        assert(m.startsWith('/'), `starts with / ${m}`)
      }
    })

    test('returns absolute results synchronously', async () => {
      var g = new Glob(pattern, { absolute: true })
      const results = g.walkSync()

      assert.equal(
        results.length,
        bashResults[pattern]!.length,
        'must match all files',
      )
      for (const m of results) {
        ok(m)
      }
    })
  })
}
