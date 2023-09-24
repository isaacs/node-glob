import { resolve, sep } from 'path'
import t from 'tap'
import { Glob } from '../dist/esm/index.js'

const alphasort = (a: string, b: string) => a.localeCompare(b, 'en')
const j = (a: string[]) =>
  a
    .map(s => s.split(process.cwd()).join('{CWD}').split(sep).join('/'))
    .sort(alphasort)

t.test('set root option', t => {
  const cwd = t.testdir({
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
  t.plan(3)
  for (const absolute of [true, false, undefined]) {
    t.test(`absolute=${absolute}`, async t => {
      const g = new Glob(pattern, { root, absolute, cwd })
      t.matchSnapshot(j(await g.walk()), 'async')
      t.matchSnapshot(j(g.walkSync()), 'sync')
    })
  }
})
