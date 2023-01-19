import * as fs from 'fs'
import { resolve } from 'path'
import t from 'tap'
import glob from '../'
import type { GlobOptions } from '../src/index.js'

// pattern to find a bunch of duplicates
const pattern = 'a/symlink/{*,**/*/*/*,*/*/**,*/*/*/*/*/*}'
const fixtureDir = resolve(__dirname, 'fixtures')
const origCwd = process.cwd()
process.chdir(fixtureDir)

if (process.platform === 'win32') {
  t.plan(0, 'skip on windows')
} else {
  // options, results
  // realpath:true set on each option

  type Case = [options: GlobOptions, results: string[], pattern?: string]
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
      { nonull: true },
      ['no one here but us chickens', 'no one here but us sheep'],
      'no one here but us {chickens,sheep}',
    ],

    [
      { nounique: true },
      [
        'a/symlink',
        'a/symlink',
        'a/symlink',
        'a/symlink/a',
        'a/symlink/a',
        'a/symlink/a',
        'a/symlink/a/b',
        'a/symlink/a/b',
      ],
    ],

    [
      { nounique: true, mark: true },
      [
        'a/symlink/',
        'a/symlink/',
        'a/symlink/',
        'a/symlink/a/',
        'a/symlink/a/',
        'a/symlink/a/',
        'a/symlink/a/b/',
        'a/symlink/a/b/',
      ],
    ],

    [
      { nounique: true, mark: true, follow: true },
      [
        // this one actually just has HELLA entries, don't list them all here
        // plus it differs based on the platform.  follow:true is kinda cray.
        'a/symlink/',
        'a/symlink/a/',
        'a/symlink/a/b/',
      ],
    ],
  ]

  for (const [opt, raw, p = pattern] of cases) {
    const expect = !(opt.nonull && raw[0].match(/^no one here/))
      ? raw.map(function (d) {
          d = (opt.cwd ? resolve(opt.cwd) : fixtureDir) + '/' + d
          return d.replace(/\\/g, '/')
        })
      : raw

    t.test(p + ' ' + JSON.stringify(opt), async t => {
      opt.realpath = true
      if (!(opt.follow && opt.nounique)) {
        t.same(glob.sync(p, opt), expect, 'sync')
        const a = await glob(p, opt)
        t.same(a, expect, 'async')
      } else {
        // follow with nounique is wild, just verify it has a lot of entries,
        // and that all the expected ones are found.
        const s = glob.sync(p, opt)
        const a = await glob(p, opt)
        t.ok(s.length > 5, 'more than 5 entries found sync', {
          found: s.length,
          expect: '>5',
          matches: s,
        })
        t.ok(a.length > 5, 'more than 5 entries found async', {
          found: a.length,
          expect: '>5',
          matches: a,
        })
        for (const e of expect) {
          t.ok(s.includes(e), 'found ' + e + ' sync')
          t.ok(a.includes(e), 'found ' + e + ' async')
        }
      }
    })
  }

  t.test('realpath failure', async t => {
    process.chdir(origCwd)
    const { glob } = t.mock('../dist/cjs/index.js', {
      fs: {
        ...fs,
        realpath: (_: string, cb: (er: Error) => void) =>
          cb(new Error('no realpath for you async')),
        realpathSync: () => {
          throw new Error('no error for you sync')
        },
      },
    })
    const pattern = 'a/symlink/a/b/c/a/b/**'
    const expect = ['a/symlink/a/b/c/a/b/', 'a/symlink/a/b/c/a/b/c'].map(
      e => resolve(fixtureDir, e)
    )
    t.test('setting cwd explicitly', async t => {
      const opt = { realpath: true, cwd: fixtureDir }
      t.same(glob.sync(pattern, opt), expect)
      t.same(await glob(pattern, opt), expect)
    })
    t.test('looking in cwd', async t => {
      process.chdir(fixtureDir)
      const opt = { realpath: true }
      t.same(glob.sync(pattern, opt), expect)
      t.same(await glob(pattern, opt), expect)
    })
  })
}
