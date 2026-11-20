// Set up the fixtures. Each test file that uses them imports this
// module. The test files run at the same time, so each step must be
// safe to run again, and at the same time as another process.
//
// Run this file directly with TEST_REGEN=1 to make the bash pattern
// results again: npm run test-regen

import { spawn } from 'child_process'
import { mkdirSync, promises, symlinkSync, writeFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const { writeFile } = promises

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const fixtureDir = resolve(__dirname, 'fixtures')

const filesUnresolved = [
  'a/.abcdef/x/y/z/a',
  'a/abcdef/g/h',
  'a/abcfed/g/h',
  'a/b/c/d',
  'a/bc/e/f',
  'a/c/d/c/b',
  'a/cb/e/f',
  'a/x/.y/b',
  'a/z/.y/b',
]

const symlinkTo = resolve(fixtureDir, 'a/symlink/a/b/c')
const symlinkFrom = '../..'

for (const file of filesUnresolved) {
  const f = resolve(fixtureDir, file)
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, 'i like tests')
}

if (process.platform !== 'win32') {
  mkdirSync(dirname(symlinkTo), { recursive: true })
  try {
    symlinkSync(symlinkFrom, symlinkTo, 'dir')
  } catch (er) {
    if ((er as NodeJS.ErrnoException).code !== 'EEXIST') throw er
  }
}

for (const s of ['foo', 'bar', 'baz', 'asdf', 'quux', 'qwer', 'rewq']) {
  mkdirSync(`/tmp/glob-test/${s}`, { recursive: true })
}

// generate the bash pattern test-fixtures if possible
if (process.argv[1] !== fileURLToPath(import.meta.url)) {
  // imported by a test file: the fixtures are ready
} else if (process.platform === 'win32' || !process.env.TEST_REGEN) {
  console.error('Windows, or TEST_REGEN unset.  Using cached fixtures.')
} else {
  const globs =
    // put more patterns here.
    // anything that would be directly in / should be in /tmp/glob-test
    [
      'a/c/d/*/b',
      'a//c//d//*//b',
      'a/*/d/*/b',
      'a/*/+(c|g)/./d',
      'a/**/[cg]/../[cg]',
      'a/{b,c,d,e,f}/**/g',
      'a/b/**',
      './**/g',
      'a/abc{fed,def}/g/h',
      'a/abc{fed/g,def}/**/',
      'a/abc{fed/g,def}/**///**/',
      // When a ** is the FIRST item in a pattern, it has
      // more restrictive symbolic link handling behavior.
      '**/a',
      '**/a/**',
      './**/a',
      './**/a/**/',
      './**/a/**',
      './**/a/**/a/**/',
      '+(a|b|c)/a{/,bc*}/**',
      '*/*/*/f',
      './**/f',
      'a/symlink/a/b/c/a/b/c/a/b/c//a/b/c////a/b/c/**/b/c/**',
      '{./*/*,/tmp/glob-test/*}',
      '{/tmp/glob-test/*,*}', // evil owl face!  how you taunt me!
      'a/!(symlink)/**',
      'a/symlink/a/**/*',
      // this one we don't quite match bash, because when bash
      // applies the .. to the symlink walked by **, it effectively
      // resets the symlink walk limit, and that is just a step too
      // far for an edge case no one knows or cares about, even for
      // an obsessive perfectionist like me.
      // './a/**/../*/**',
      'a/!(symlink)/**/..',
      'a/!(symlink)/**/../',
      'a/!(symlink)/**/../*',
      'a/!(symlink)/**/../*/*',
    ]

  const bashOutput: { [k: string]: string[] } = {}

  for (const pattern of globs) {
    await new Promise<void>((res, rej) => {
      const opts = [
        '-O',
        'globstar',
        '-O',
        'extglob',
        '-O',
        'nullglob',
        '-c',
        `for i in ${pattern}; do echo $i; done`,
      ]
      const cp = spawn('bash', opts, { cwd: fixtureDir })
      const out: Buffer[] = []
      cp.stdout.on('data', c => out.push(c))
      cp.stderr.pipe(process.stderr)
      cp.on('close', function (code) {
        const o = flatten(out)
        bashOutput[pattern] = !o ? [] : cleanResults(o.split(/\r*\n/))
        if (code) rej(new Error(`bash failed for ${pattern}: ${code}`))
        else res()
      })
    })
  }

  const fname = resolve(__dirname, 'bash-results.ts')
  const data = `// generated via 'npm run test-regen'
export const bashResults:{ [path: string]: string[] } = ${JSON.stringify(
    bashOutput,
    null,
    2,
  )}
`
  await writeFile(fname, data)

  await new Promise<void>((res, rej) => {
    const c = spawn('prettier', ['--write', fname], {
      stdio: ['ignore', 2, 2],
    })
    c.on('close', (code, signal) => {
      if (code || signal)
        rej(new Error(`prettier failed: ${code} ${signal}`))
      else res()
    })
  })

  function cleanResults(m: string[]) {
    // normalize discrepancies in ordering, duplication,
    // and ending slashes.
    return m
      .map(m => join(m.replace(/\/$/, '').replace(/\/+/g, '/')))
      .sort(alphasort)
      .reduce(function (set: string[], f) {
        if (f !== set[set.length - 1]) set.push(f)
        return set
      }, [])
      .sort(alphasort)
      .map(function (f) {
        // de-windows
        return process.platform !== 'win32' ?
            f
          : f.replace(/^[a-zA-Z]:\\\\/, '/').replace(/\\/g, '/')
      })
  }

  const flatten = (chunks: Buffer[]) =>
    Buffer.concat(chunks).toString().trim()

  const alphasort = (a: string, b: string) =>
    a.toLowerCase().localeCompare(b.toLowerCase(), 'en')
}
