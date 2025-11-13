// https://github.com/isaacs/node-glob/issues/547
import t from 'tap'

import { globSync } from '../dist/esm/index.js'
import { statSync } from 'node:fs'

const dir = t.testdir({
  'program files': {
    a: '',
    b: '',
    c: '',
  },
})

// gut check that we're on a system that does tilde expansion
// this can be disabled on some Windows systems for security,
// which of course breaks this test.
try {
  const programFiles = statSync(`${dir}/program files`)
  const prograTilde = statSync(`${dir}/progra~1`)
  if (
    !programFiles.isDirectory() ||
    !prograTilde.isDirectory() ||
    programFiles.dev !== prograTilde.dev ||
    programFiles.ino !== prograTilde.ino
  ) {
    throw 'nope'
  }
} catch {
  t.pass('n/a', { skip: 'this system does not do tilde expansion' })
  process.exit(0)
}

t.strictSame(
  globSync('progra~1\\*', { cwd: dir, windowsPathsNoEscape: true }).sort(
    (a, b) => a.localeCompare(b, 'en'),
  ),
  ['progra~1\\a', 'progra~1\\b', 'progra~1\\c'],
)
