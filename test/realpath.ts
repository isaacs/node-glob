import * as fs from 'fs'
import * as fsp from 'fs/promises'
import { resolve } from 'path'
import { assert, cleanup, describe, mockImport, test } from 'ubqtest'
import './00-setup.js'
import { glob } from '../dist/esm/index.js'
import type { GlobOptionsWithFileTypesUnset } from '../dist/esm/glob.js'
import { fileURLToPath } from 'url'

const alphasort = (a: string, b: string) => a.localeCompare(b, 'en')

// pattern to find a bunch of duplicates
const pattern = 'a/symlink/{*,**/*/*/*,*/*/**,*/*/*/*/*/*}'
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const fixtureDir = resolve(__dirname, 'fixtures')
const origCwd = process.cwd()
process.chdir(fixtureDir)

const skip = process.platform === 'win32' && 'skip on windows'

{
  // options, results
  // realpath:true set on each option

  type Case = [
    options: GlobOptionsWithFileTypesUnset,
    results: string[],
    pattern?: string,
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
    test(`${p} ${JSON.stringify(opt)}`, { skip }, async () => {
      opt.realpath = true
      assert.deepEqual(
        glob.globSync(p, opt).sort(alphasort),
        expect,
        'sync',
      )
      const a = await glob(p, opt)
      assert.deepEqual(a.sort(alphasort), expect, 'async')
    })
  }

  // glob does its fs work in path-scurry, a package in node_modules,
  // so the mock of fs goes to an instance of path-scurry.
  const mockGlob = async () => {
    const realpathSync = Object.assign(
      (p: fs.PathLike) => fs.realpathSync(p),
      {
        native: () => {
          throw new Error('no error for you sync')
        },
      },
    ) as unknown as typeof fs.realpathSync
    const scurry = await mockImport(
      () => import('path-scurry'),
      [
        [() => import('fs'), { ...fs, realpathSync }],
        [
          () => import('node:fs/promises'),
          {
            ...fsp,
            realpath: async () => {
              throw new Error('no error for you async')
            },
          },
        ],
      ],
    )
    const { glob } = await mockImport(
      () => import('../dist/esm/index.js'),
      [[() => import('path-scurry'), scurry]],
    )
    return glob
  }

  // failing realpath means that it does not include the result
  describe('realpath failure', { skip }, () => {
    const pattern = 'a/symlink/a/b/c/a/b/**'
    test('setting cwd explicitly', async () => {
      process.chdir(origCwd)
      cleanup(() => process.chdir(fixtureDir))
      const glob = await mockGlob()
      const opt = { realpath: true, cwd: fixtureDir }
      assert.deepEqual(glob.globSync(pattern, opt), [])
      assert.deepEqual(await glob(pattern, opt), [])
    })
    test('looking in cwd', async () => {
      const glob = await mockGlob()
      const opt = { realpath: true }
      assert.deepEqual(glob.globSync(pattern, opt), [])
      assert.deepEqual(await glob(pattern, opt), [])
    })
  })
}
