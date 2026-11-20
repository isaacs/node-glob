// Compare the native fs.glob and fs.globSync with the bash results of
// each pattern. This is not a test of node-glob: it is a way to spot
// differences between node-glob and the glob of node core.
//
// Run: npm run native-glob
// It prints each difference, and exits 1 if there is one.

import './00-setup.ts'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { bashResults } from './bash-results.ts'

if (!fs.glob || !fs.globSync || !fsp.glob) {
  console.error('This version of node does not include fs.glob')
  process.exit(1)
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))
process.chdir(resolve(__dirname, 'fixtures'))

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

let differences = 0
const check = (pattern: string, kind: string, results: string[]) => {
  const expect = bashResults[pattern]
  const matches = cleanResults(results)
  if (isDeepStrictEqual(matches, expect)) return
  differences++
  console.log(`${pattern} (${kind})`)
  console.log(`  bash:    ${JSON.stringify(expect)}`)
  console.log(`  fs.glob: ${JSON.stringify(matches)}`)
}

for (const pattern of Object.keys(bashResults)) {
  // anything regarding the symlink thing will fail on windows
  if (
    process.platform === 'win32' &&
    bashResults[pattern]?.some((m: string) => /\bsymlink\b/.test(m))
  ) {
    continue
  }

  const iterated: string[] = []
  for await (const res of fsp.glob(pattern)) iterated.push(res)
  check(pattern, 'async iterator', iterated)

  check(
    pattern,
    'async callback',
    await new Promise<string[]>((res, rej) =>
      fs.glob(pattern, (er, results) => (er ? rej(er) : res(results))),
    ),
  )

  check(pattern, 'sync', fs.globSync(pattern))
}

console.log(`${differences} differences`)
process.exitCode = differences ? 1 : 0
