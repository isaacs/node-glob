// test the native fs.glob and fs.globSync against all our patterns
// This is not so much for testing node-glob, so failures are reduced
// to just warnings by default.
//
// Run this with `TEST_NATIVE_GLOB=1` in the environment to turn failures
// into actual test failures.

import t from 'tap'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bashResults } from './bash-results.js'
import { same } from 'tcompare'
const globs = Object.keys(bashResults)

const testNativeGlob = !!Number(process.env.TEST_NATIVE_GLOB ?? '0')

if (!fs.glob || !fs.globSync || !fsp.glob) {
  t.plan(0, 'This version of node does not include fs.glob')
  process.exit(testNativeGlob ? 1 : 0)
}

// run from the root of the project
// this is usually where you're at anyway, but be sure.
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const fixtures = resolve(__dirname, 'fixtures')
process.chdir(fixtures)

const alphasort = (a: string, b: string) =>
  a.toLowerCase().localeCompare(b.toLowerCase(), 'en')

const cleanResults = (m: string[]) => {
  // normalize discrepancies in ordering, duplication,
  // and ending slashes.
  return m
    .map(m => m.replace(/\/$/, ''))
    .sort(alphasort)
    .reduce((set: string[], f) => {
      if (f !== set[set.length - 1]) set.push(f)
      return set
    }, [])
    .map(f => {
      // de-windows
      return process.platform !== 'win32' ?
          f
        : f.replace(/^[a-zA-Z]:[/\\]+/, '/').replace(/[\\/]+/g, '/')
    })
    .sort(alphasort)
}

globs.forEach(function (pattern) {
  let expect = bashResults[pattern]
  // anything regarding the symlink thing will fail on windows
  if (
    process.platform === 'win32' &&
    expect?.some((m: string) => /\bsymlink\b/.test(m))
  ) {
    return
  }

  t.test(`${pattern} async iterator`, async t => {
    // sort and unmark, just to match the shell results
    const results: string[] = []
    for await (const res of fsp.glob(pattern)) {
      results.push(res)
    }
    const matches = cleanResults(results)
    // don't mark it TODO if it passes, or if we're testing for reals
    const todo = !(testNativeGlob || same(matches, expect).match)
    t.same(matches, expect, pattern, { todo })
  })

  t.test(`${pattern} async callback`, t => {
    fs.glob(pattern, (er, results) => {
      if (er) throw er
      const matches = cleanResults(results)
      const todo = !(testNativeGlob || same(matches, expect).match)
      t.same(matches, expect, pattern, { todo })
      t.end()
    })
  })

  t.test(`${pattern} sync`, async t => {
    const matches = cleanResults(fs.globSync(pattern))
    const todo = !(testNativeGlob || same(matches, expect).match)
    t.same(matches, expect, pattern, { todo })
  })
})
