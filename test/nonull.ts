import t from 'tap'
import {glob, GlobOptions} from '../'
process.chdir(__dirname)

// [pattern, options, expect]
const cases:[string, GlobOptions, string[]][] = [
  ['a/*NOFILE*/**/', {}, ['a/*NOFILE*/**/']],
  ['*/*', { cwd: 'NODIR' }, ['*/*']],
  ['NOFILE', {}, ['NOFILE']],
  ['NOFILE', { cwd: 'NODIR' }, ['NOFILE']],
  // this is the weird one, because a/b actually does exist,
  // and we've said we want to ignore it, but also it's the pattern,
  // and nonull is set, so nonull takes precedence.
  ['a/b', { ignore: 'a/**' }, ['a/b']],
]

for (const [pattern, options, expect] of cases) {
  options.nonull = true
  expect.sort()
  t.test(pattern + ' ' + JSON.stringify(options), async t => {
    t.same(glob.sync(pattern, options).sort(), expect, 'sync results')
    t.same((await glob(pattern, options)).sort(), expect, 'async results')
  })
}
