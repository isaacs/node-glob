import * as fs from 'fs'
import * as fsp from 'fs/promises'
import { resolve } from 'path'
import t from 'tap'
import { glob } from '../dist/esm/index.js'
import { GlobOptionsWithFileTypesUnset } from '../dist/esm/glob.js'
import {fileURLToPath} from 'url'

const alphasort = (a: string, b: string) => a.localeCompare(b, 'en')

// pattern to find a bunch of duplicates
const pattern = 'a/symlink/{*,**/*/*/*,*/*/**,*/*/*/*/*/*}'
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const fixtureDir = resolve(__dirname, 'fixtures')
const origCwd = process.cwd()
process.chdir(fixtureDir)

if (process.platform === 'win32') {
  t.plan(0, 'skip on windows')
} else {
  // options, results
  // realpath:true set on each option

  type Case = [
    options: GlobOptionsWithFileTypesUnset,
    results: string[],
    pattern?: string
  ]
  const cases: Case[] = [
    [{}, ['a/symlink', 'a/symlink/a', 'a/symlink/a/b']],

    [{ mark: true }, ['a/symlink/', 'a/symlink/a/', 'a/symlink/a/b/']],

    [{ follow: true }, ['a/symlink', 'a/symlink/a', 'a/symlink/a/b']],

    [
      { cwd: 'a' },
      ['symlink', 'symlink/a', 'symlink/a/b'],
      pattern.substring(2),
    ],

    [{ cwd: 'a' }, [], 'no one here but us chickens'],

    [
      { mark: true, follow: true },
      [
        // this one actually just has HELLA entries, don't list them all here
        // plus it differs based on the platform.  follow:true is kinda cray.
        'a/symlink/',
        'a/symlink/a/',
        'a/symlink/a/b/',
      ],
    ],
  ]

  for (const [opt, expect, p = pattern] of cases) {
    expect.sort(alphasort)
    t.test(p + ' ' + JSON.stringify(opt), async t => {
      opt.realpath = true
      t.same(glob.globSync(p, opt).sort(alphasort), expect, 'sync')
      const a = await glob(p, opt)
      t.same(a.sort(alphasort), expect, 'async')
    })
  }

  t.test('realpath failure', async t => {
    // failing realpath means that it does not include the result
    process.chdir(origCwd)
    const { glob } = await t.mockImport('../dist/esm/index.js', {
      fs: {
        ...fs,
        realpathSync: Object.assign(fs.realpathSync, {
          native: () => {
            throw new Error('no error for you sync')
          },
        }),
      },
      'fs/promises': {
        ...fsp,
        realpath: async () => {
          throw new Error('no error for you async')
        },
      },
    }) as typeof import('../dist/esm/index.js')
    const pattern = 'a/symlink/a/b/c/a/b/**'
    t.test('setting cwd explicitly', async t => {
      const opt = { realpath: true, cwd: fixtureDir }
      t.same(glob.globSync(pattern, opt), [])
      t.same((await glob(pattern, opt)), [])
    })
    t.test('looking in cwd', async t => {
      process.chdir(fixtureDir)
      const opt = { realpath: true }
      t.same(glob.globSync(pattern, opt), [])
      t.same((await glob(pattern, opt)), [])
    })
  })
}
