import { symlinkSync } from 'fs'
import { relative } from 'path'
import { assert, describe, test, testdir } from 'ubqtest'
import { glob } from '../dist/esm/index.js'
import type { GlobOptionsWithFileTypesUnset } from '../dist/esm/glob.js'

const skip = process.platform === 'win32' && 'skip on windows'

const dir = relative(process.cwd(), testdir({ a: { 'broken-link': {} } }))
if (!skip) symlinkSync('this-does-not-exist', `${dir}/a/broken-link/link`)

const link = `${dir}/a/broken-link/link`

const patterns = [
  `${dir}/a/broken-link/*`,
  `${dir}/a/broken-link/**`,
  `${dir}/a/broken-link/**/link`,
  `${dir}/a/broken-link/**/*`,
  `${dir}/a/broken-link/link`,
  `${dir}/a/broken-link/{link,asdf}`,
  `${dir}/a/broken-link/+(link|asdf)`,
  `${dir}/a/broken-link/!(asdf)`,
]

const opts: (GlobOptionsWithFileTypesUnset | undefined)[] = [
  undefined,
  { mark: true },
  { follow: true },
]

describe('async test', { skip }, () => {
  for (const pattern of patterns) {
    test(pattern, async () => {
      for (const opt of opts) {
        const res = await glob(pattern, opt)
        const msg = `${pattern} ${JSON.stringify(opt)}`
        assert.notEqual(res.indexOf(link), -1, msg)
      }
    })
  }
})

describe('sync test', { skip }, () => {
  for (const pattern of patterns) {
    test(pattern, () => {
      for (const opt of opts) {
        const res = glob.globSync(pattern, opt)
        assert.notEqual(
          res.indexOf(link),
          -1,
          `opt=${JSON.stringify(opt)}`,
        )
      }
    })
  }
})
