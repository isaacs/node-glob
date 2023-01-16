// remove the fixtures
process.env.TAP_BAIL = '1'
import { createWriteStream } from 'fs'
import { resolve } from 'path'
import { rimraf } from 'rimraf'
import t from 'tap'
//@ts-ignore
t.pipe(createWriteStream('zz-cleanup.tap'))

t.test(
  'cleanup fixtures',
  async () => await rimraf(resolve(__dirname, 'fixtures'))
)
