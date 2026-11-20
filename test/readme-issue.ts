import { assert, test, testdir } from 'ubqtest'
import { glob } from '../dist/esm/index.js'

const dir = testdir({
  'package.json': '{}',
  README: 'x',
})

test('glob', async () => {
  var opt = {
    cwd: dir,
    nocase: true,
    mark: true,
  }

  assert.deepEqual(await glob('README?(.*)', opt), ['README'])
})
