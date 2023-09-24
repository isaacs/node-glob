import { relative } from 'path'
import t from 'tap'
import { glob } from '../dist/esm/index.js'
import { GlobOptionsWithFileTypesUnset } from '../dist/esm/glob.js'

if (process.platform === 'win32') {
  t.plan(0, 'skip on windows')
  process.exit(0)
}

const dir = relative(
  process.cwd(),
  t.testdir({
    a: {
      'broken-link': {
        link: t.fixture('symlink', 'this-does-not-exist'),
      },
    },
  })
)

const link = `${dir}/a/broken-link/link`

const patterns = [
  `${dir}/a/broken-link/*`,
  `${dir}/a/broken-link/**`,
  `${dir}/a/broken-link/**/link`,
  `${dir}/a/broken-link/**/*`,
  `${dir}/a/broken-link/link`,
  `${dir}/a/broken-link/{link,asdf}`,
  `${dir}/a/broken-link/+(link|asdf)`,
  `${dir}/a/broken-link/!(asdf)`,
]

const opts: (GlobOptionsWithFileTypesUnset | undefined)[] = [
  undefined,
  { mark: true },
  { follow: true },
]

t.test('async test', t => {
  t.plan(patterns.length)
  for (const pattern of patterns) {
    t.test(pattern, async t => {
      t.plan(opts.length)
      for (const opt of opts) {
        const res = await glob(pattern, opt)
        const msg = pattern + ' ' + JSON.stringify(opt)
        t.not(res.indexOf(link), -1, msg)
      }
    })
  }
})

t.test('sync test', t => {
  t.plan(patterns.length)
  for (const pattern of patterns) {
    t.test(pattern, t => {
      t.plan(opts.length)
      for (const opt of opts) {
        const res = glob.globSync(pattern, opt)
        t.not(res.indexOf(link), -1, 'opt=' + JSON.stringify(opt))
      }
    })
  }
})
