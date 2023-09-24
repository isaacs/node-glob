// basic test
// show that it does the same thing by default as the shell.
import { resolve } from 'path'
import t from 'tap'
import { fileURLToPath } from 'url'
import { glob } from '../dist/esm/index.js'
import { bashResults } from './bash-results.js'
const globs = Object.keys(bashResults)

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
      return process.platform !== 'win32'
        ? f
        : f.replace(/^[a-zA-Z]:[\/\\]+/, '/').replace(/[\\\/]+/g, '/')
    })
    .sort(alphasort)
}

globs.forEach(function (pattern) {
  var expect = bashResults[pattern]
  // anything regarding the symlink thing will fail on windows, so just skip it
  if (
    process.platform === 'win32' &&
    expect?.some((m: string) => /\bsymlink\b/.test(m))
  ) {
    return
  }

  t.test(pattern, async t => {
    // sort and unmark, just to match the shell results
    const matches = cleanResults(await glob(pattern))
    t.same(matches, expect, pattern)
  })

  t.test(pattern + ' sync', async t => {
    const matches = cleanResults(glob.globSync(pattern))
    t.same(matches, expect, 'should match shell (sync)')
  })
})
