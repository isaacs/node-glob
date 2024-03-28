// just a little pre-run script to set up the fixtures.
// zz-finish cleans it up

import { spawn } from 'child_process'
import { createWriteStream, promises } from 'fs'
import { mkdirp } from 'mkdirp'
import { join, dirname, resolve } from 'path'
import t from 'tap'
import {fileURLToPath} from 'url'

const { writeFile, symlink } = promises
//@ts-ignore
t.pipe(createWriteStream('00-setup.tap'))
process.env.TAP_BAIL = '1'

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

const files = filesUnresolved.map(f => resolve(fixtureDir, f))

for (const file of files) {
  t.test(file, { bail: true }, async () => {
    const f = resolve(fixtureDir, file)
    const d = dirname(f)
    await mkdirp(d)
    await writeFile(f, 'i like tests')
  })
}

if (process.platform !== 'win32') {
  t.test('symlinky', async () => {
    const d = dirname(symlinkTo)
    await mkdirp(d)
    await symlink(symlinkFrom, symlinkTo, 'dir')
  })
}

;['foo', 'bar', 'baz', 'asdf', 'quux', 'qwer', 'rewq'].forEach(function (
  w
) {
  w = '/tmp/glob-test/' + w
  t.test('create ' + w, async t => {
    await mkdirp(w)
    t.pass(w)
  })
})

// generate the bash pattern test-fixtures if possible
if (process.platform === 'win32' || !process.env.TEST_REGEN) {
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
    t.test('generate fixture ' + pattern, t => {
      const opts = [
        '-O',
        'globstar',
        '-O',
        'extglob',
        '-O',
        'nullglob',
        '-c',
        'for i in ' + pattern + '; do echo $i; done',
      ]
      const cp = spawn('bash', opts, { cwd: fixtureDir })
      const out: Buffer[] = []
      cp.stdout.on('data', c => out.push(c))
      cp.stderr.pipe(process.stderr)
      cp.on('close', function (code) {
        const o = flatten(out)
        bashOutput[pattern] = !o ? [] : cleanResults(o.split(/\r*\n/))
        t.notOk(code, 'bash test should finish nicely')
        t.end()
      })
    })
  }

  t.test('save fixtures', async () => {
    const fname = resolve(__dirname, 'bash-results.ts')
    const data = `// generated via 'npm run test-regen'
import { fileURLToPath } from 'url'

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('TAP version 14\\n1..1\\nok\\n')
}

export const bashResults:{ [path: string]: string[] } = ${
      JSON.stringify(bashOutput, null, 2) + '\n'
    }
`
    await writeFile(fname, data)
  })

  t.test('formatting', t => {
    const c = spawn(
      'prettier',
      ['--write', resolve(__dirname, 'bash-results.ts')],
      { stdio: ['ignore', 2, 2] }
    )
    c.on('close', (code, signal) => {
      t.equal(code, 0, 'code')
      t.equal(signal, null, 'signal')
      t.end()
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
        return process.platform !== 'win32'
          ? f
          : f.replace(/^[a-zA-Z]:\\\\/, '/').replace(/\\/g, '/')
      })
  }

  const flatten = (chunks: Buffer[]) =>
    Buffer.concat(chunks).toString().trim()

  const alphasort = (a: string, b: string) =>
    a.toLowerCase().localeCompare(b.toLowerCase(), 'en')
}
