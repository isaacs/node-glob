// Ignore option test
// Show that glob ignores results matching pattern on ignore option

import { sep } from 'path'
import t from 'tap'
import { fileURLToPath } from 'url'
import type { GlobOptions } from '../dist/esm/index.js'
import { glob } from '../dist/esm/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const alphasort = (a: string, b: string) => a.localeCompare(b, 'en')
const j = (a: string[]) =>
  a.map(s => s.split('/').join(sep)).sort(alphasort)

process.chdir(fileURLToPath(new URL('./fixtures', import.meta.url)))

// [pattern, ignore, expect, opt (object) or cwd (string)]
type Case = [
  pattern: string,
  ignore: null | string | string[],
  expect: string[],
  optOrCwd?: GlobOptions | string | undefined
]

const cases: Case[] = [
  [
    '*',
    null,
    j(['abcdef', 'abcfed', 'b', 'bc', 'c', 'cb', 'symlink', 'x', 'z']),
    'a',
  ],
  [
    '*',
    ['b'],
    j(['abcdef', 'abcfed', 'bc', 'c', 'cb', 'symlink', 'x', 'z']),
    'a',
  ],
  [
    '*',
    'b*',
    j(['abcdef', 'abcfed', 'c', 'cb', 'symlink', 'x', 'z']),
    'a',
  ],
  ['b/**', 'b/c/d', j(['b', 'b/c']), 'a'],
  ['b/**', 'd', j(['b', 'b/c', 'b/c/d']), 'a'],
  ['b/**', 'b/c/**', ['b'], 'a'],
  ['b/**', (process.cwd() + '/a/b/c/**').split(sep).join('/'), ['b'], 'a'],
  ['**/d', 'b/c/d', j(['c/d']), 'a'],
  [
    'a/**/[gh]',
    ['a/abcfed/g/h'],
    j(['a/abcdef/g', 'a/abcdef/g/h', 'a/abcfed/g']),
  ],
  [
    '*',
    ['c', 'bc', 'symlink', 'abcdef'],
    ['abcfed', 'b', 'cb', 'x', 'z'],
    'a',
  ],
  [
    '**',
    ['c/**', 'bc/**', 'symlink/**', 'abcdef/**'],
    j([
      '.',
      'abcfed',
      'abcfed/g',
      'abcfed/g/h',
      'b',
      'b/c',
      'b/c/d',
      'cb',
      'cb/e',
      'cb/e/f',
      'x',
      'z',
    ]),
    'a',
  ],
  ['a/**', ['a/**'], []],
  ['a/**', ['a/**/**'], []],
  ['a/b/**', ['a/b'], j(['a/b/c', 'a/b/c/d'])],
  [
    '**',
    ['b'],
    j([
      '.',
      'abcdef',
      'abcdef/g',
      'abcdef/g/h',
      'abcfed',
      'abcfed/g',
      'abcfed/g/h',
      'b/c',
      'b/c/d',
      'bc',
      'bc/e',
      'bc/e/f',
      'c',
      'c/d',
      'c/d/c',
      'c/d/c/b',
      'cb',
      'cb/e',
      'cb/e/f',
      'symlink',
      'symlink/a',
      'symlink/a/b',
      'symlink/a/b/c',
      'x',
      'z',
    ]),
    'a',
  ],
  [
    '**',
    ['b', 'c'],
    j([
      '.',
      'abcdef',
      'abcdef/g',
      'abcdef/g/h',
      'abcfed',
      'abcfed/g',
      'abcfed/g/h',
      'b/c',
      'b/c/d',
      'bc',
      'bc/e',
      'bc/e/f',
      'c/d',
      'c/d/c',
      'c/d/c/b',
      'cb',
      'cb/e',
      'cb/e/f',
      'symlink',
      'symlink/a',
      'symlink/a/b',
      'symlink/a/b/c',
      'x',
      'z',
    ]),
    'a',
  ],
  [
    '**',
    ['b**'],
    j([
      '.',
      'abcdef',
      'abcdef/g',
      'abcdef/g/h',
      'abcfed',
      'abcfed/g',
      'abcfed/g/h',
      'b/c',
      'b/c/d',
      'bc/e',
      'bc/e/f',
      'c',
      'c/d',
      'c/d/c',
      'c/d/c/b',
      'cb',
      'cb/e',
      'cb/e/f',
      'symlink',
      'symlink/a',
      'symlink/a/b',
      'symlink/a/b/c',
      'x',
      'z',
    ]),
    'a',
  ],
  [
    '**',
    ['b/**'],
    j([
      '.',
      'abcdef',
      'abcdef/g',
      'abcdef/g/h',
      'abcfed',
      'abcfed/g',
      'abcfed/g/h',
      'bc',
      'bc/e',
      'bc/e/f',
      'c',
      'c/d',
      'c/d/c',
      'c/d/c/b',
      'cb',
      'cb/e',
      'cb/e/f',
      'symlink',
      'symlink/a',
      'symlink/a/b',
      'symlink/a/b/c',
      'x',
      'z',
    ]),
    'a',
  ],
  [
    '**',
    ['b**/**'],
    j([
      '.',
      'abcdef',
      'abcdef/g',
      'abcdef/g/h',
      'abcfed',
      'abcfed/g',
      'abcfed/g/h',
      'c',
      'c/d',
      'c/d/c',
      'c/d/c/b',
      'cb',
      'cb/e',
      'cb/e/f',
      'symlink',
      'symlink/a',
      'symlink/a/b',
      'symlink/a/b/c',
      'x',
      'z',
    ]),
    'a',
  ],
  [
    '**',
    ['ab**ef/**'],
    j([
      '.',
      'abcfed',
      'abcfed/g',
      'abcfed/g/h',
      'b',
      'b/c',
      'b/c/d',
      'bc',
      'bc/e',
      'bc/e/f',
      'c',
      'c/d',
      'c/d/c',
      'c/d/c/b',
      'cb',
      'cb/e',
      'cb/e/f',
      'symlink',
      'symlink/a',
      'symlink/a/b',
      'symlink/a/b/c',
      'x',
      'z',
    ]),
    'a',
  ],
  [
    '**',
    ['abc{def,fed}/**'],
    j([
      '.',
      'b',
      'b/c',
      'b/c/d',
      'bc',
      'bc/e',
      'bc/e/f',
      'c',
      'c/d',
      'c/d/c',
      'c/d/c/b',
      'cb',
      'cb/e',
      'cb/e/f',
      'symlink',
      'symlink/a',
      'symlink/a/b',
      'symlink/a/b/c',
      'x',
      'z',
    ]),
    'a',
  ],
  [
    '**',
    ['abc{def,fed}/*'],
    j([
      '.',
      'abcdef',
      'abcdef/g/h',
      'abcfed',
      'abcfed/g/h',
      'b',
      'b/c',
      'b/c/d',
      'bc',
      'bc/e',
      'bc/e/f',
      'c',
      'c/d',
      'c/d/c',
      'c/d/c/b',
      'cb',
      'cb/e',
      'cb/e/f',
      'symlink',
      'symlink/a',
      'symlink/a/b',
      'symlink/a/b/c',
      'x',
      'z',
    ]),
    'a',
  ],
  ['c/**', ['c/*'], j(['c', 'c/d/c', 'c/d/c/b']), 'a'],
  ['a/c/**', ['a/c/*'], j(['a/c', 'a/c/d/c', 'a/c/d/c/b'])],
  ['a/c/**', ['a/c/**', 'a/c/*', 'a/c/*/c'], []],
  ['a/**/.y', ['a/x/**'], j(['a/z/.y'])],
  ['a/**/.y', ['a/x/**'], j(['a/z/.y']), { dot: true }],
  ['a/**/b', ['a/x/**'], j(['a/b', 'a/c/d/c/b', 'a/symlink/a/b'])],
  [
    'a/**/b',
    ['a/x/**'],
    j(['a/b', 'a/c/d/c/b', 'a/symlink/a/b', 'a/z/.y/b']),
    { dot: true },
  ],
  ['*/.abcdef', 'a/**', []],
  ['a/*/.y/b', 'a/x/**', j(['a/z/.y/b'])],
  [
    'a/*/.y/b',
    (process.cwd() + '/a/x/**').split(sep).join('/'),
    j(['a/z/.y/b']),
  ],
  [
    './*',
    '{./,c}b',
    j(['abcdef', 'abcfed', 'bc', 'c', 'symlink', 'x', 'z']),
    'a',
  ],
  [
    './*',
    './c/../b',
    j(['abcdef', 'abcfed', 'bc', 'c', 'cb', 'symlink', 'x', 'z']),
    'a',
  ],
]

for (const c of cases) {
  const [pattern, ignore, ex, optCwd] = c
  const expect = (
    process.platform === 'win32'
      ? ex.filter(e => !/\bsymlink\b/.test(e))
      : ex
  ).sort()
  expect.sort()
  const opt: GlobOptions =
    (typeof optCwd === 'string' ? { cwd: optCwd } : optCwd) || {}
  const name = `p=${pattern} i=${JSON.stringify(ignore)} ${JSON.stringify(
    opt
  )}`

  if (ignore) {
    opt.ignore = ignore
  }

  t.test(name, async t => {
    const res = await glob(pattern, opt)
    t.same(res.sort(), expect, 'async')
    const resSync = glob.globSync(pattern, opt)
    t.same(resSync.sort(), expect, 'sync')
  })
}

t.test('race condition', async t => {
  process.chdir(__dirname)
  var pattern = 'fixtures/*'
  t.jobs = 64
  for (const dot of [true, false]) {
    for (const ignore of ['fixtures/**', undefined]) {
      for (const cwd of [undefined, process.cwd(), '.']) {
        const opt: GlobOptions = {
          dot,
          ignore,
        }
        if (cwd) opt.cwd = cwd
        const expect = ignore ? [] : j(['fixtures/a'])
        t.test(JSON.stringify(opt), async t => {
          t.plan(2)
          t.same(glob.globSync(pattern, opt).sort(), expect)
          t.same((await glob(pattern, opt)).sort(), expect)
        })
      }
    }
  }
})
