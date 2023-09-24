import { resolve, sep } from 'path'
import t from 'tap'
import { fileURLToPath } from 'url'
import type { GlobOptions } from '../dist/esm/index.js'
import { glob } from '../dist/esm/index.js'

process.chdir(fileURLToPath(new URL('./fixtures', import.meta.url)))

const alphasort = (a: string, b: string) => a.localeCompare(b, 'en')
const j = (a: string[]) =>
  a.map(s => s.split('/').join(sep)).sort(alphasort)

// [pattern, options, expect]
const root = resolve('a')
const cases: [string, GlobOptions, string[]][] = [
  [
    '*/**',
    { cwd: 'a' },
    j([
      'abcdef/g/h',
      'abcfed/g/h',
      'b/c/d',
      'bc/e/f',
      'c/d/c/b',
      'cb/e/f',
      'symlink/a/b/c',
    ]),
  ],
  [
    'a/*b*/**',
    {},
    j(['a/abcdef/g/h', 'a/abcfed/g/h', 'a/b/c/d', 'a/bc/e/f', 'a/cb/e/f']),
  ],
  ['a/*b*/**/', {}, []],
  ['*/*', { cwd: 'a' }, []],
  ['*/*', { cwd: root }, []],
]

for (const [pattern, options, expectRaw] of cases) {
  options.nodir = true
  const expect =
    process.platform === 'win32'
      ? expectRaw.filter(e => !/\bsymlink\b/.test(e))
      : expectRaw
  expect.sort()
  if (process.platform !== 'win32') {
  }
  t.test(pattern + ' ' + JSON.stringify(options), async t => {
    t.same(glob.globSync(pattern, options).sort(), expect, 'sync results')
    t.same((await glob(pattern, options)).sort(), expect, 'async results')
  })
}
