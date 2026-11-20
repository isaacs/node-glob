import { resolve, sep } from 'path'
import { assert, describe, test, testdir } from 'ubqtest'
import { Glob } from '../dist/esm/index.js'

const alphasort = (a: string, b: string) => a.localeCompare(b, 'en')
const j = (a: string[]) =>
  a
    .map(s => s.split(process.cwd()).join('{CWD}').split(sep).join('/'))
    .sort(alphasort)

describe('set root option', () => {
  const cwd = testdir({
    x: {
      a: '',
      x: {
        a: '',
        x: {
          a: '',
          y: {
            r: '',
          },
        },
        y: {
          r: '',
        },
      },
      y: {
        r: '',
      },
    },
    y: {
      r: '',
    },
  })

  const pattern = ['**/r', '/**/a', '/**/../y']
  const root = resolve(cwd, 'x/x')
  for (const absolute of [true, false, undefined]) {
    test(`absolute=${absolute}`, async () => {
      const g = new Glob(pattern, { root, absolute, cwd })
      assert.snapshot(j(await g.walk()), 'async')
      assert.snapshot(j(g.walkSync()), 'sync')
    })
  }
})
