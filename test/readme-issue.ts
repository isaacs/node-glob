import t from 'tap'
import { glob } from '../'

const dir = t.testdir({
  'package.json': '{}',
  README: 'x',
})

t.test('glob', async t => {
  var opt = {
    cwd: dir,
    nocase: true,
    mark: true,
  }

  t.same(await glob('README?(.*)', opt), ['README'])
})
