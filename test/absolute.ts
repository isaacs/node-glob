import { isAbsolute } from 'path'
import t, { Test } from 'tap'
import { fileURLToPath } from 'url'
import { Glob } from '../dist/esm/index.js'
import { bashResults } from './bash-results.js'

const pattern = 'a/b/**'
const __dirname = fileURLToPath(new URL('.', import.meta.url))
process.chdir(__dirname + '/fixtures')

const ok = (t: Test, file: string) =>
  t.ok(isAbsolute(file), 'must be absolute', { found: file })

var marks = [true, false]
for (const mark of marks) {
  t.test('mark=' + mark, t => {
    t.plan(2)

    t.test('Emits absolute matches if option set', async t => {
      var g = new Glob(pattern, { absolute: true, posix: true })
      const results = await g.walk()

      t.equal(
        results.length,
        bashResults[pattern]?.length,
        'must match all files'
      )
      for (const m of results) {
        t.ok(m.startsWith('/'), 'starts with / ' + m)
      }
    })

    t.test('returns absolute results synchronously', async t => {
      var g = new Glob(pattern, { absolute: true })
      const results = g.walkSync()

      t.equal(
        results.length,
        bashResults[pattern]?.length,
        'must match all files'
      )
      for (const m of results) {
        ok(t, m)
      }
    })
  })
}
