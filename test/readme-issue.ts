import t from 'tap'
import glob from '../'

import { writeFileSync } from 'fs'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
const dir = __dirname + '/package'

t.before(() => {
  mkdirp.sync(dir)
  writeFileSync(dir + '/package.json', '{}', 'ascii')
  writeFileSync(dir + '/README', 'x', 'ascii')
})

t.teardown(() => rimraf.sync(dir))

t.test('glob', async t => {
  var opt = {
    cwd: dir,
    nocase: true,
    mark: true,
  }

  t.same(await glob('README?(.*)', opt), ['README'])
})
