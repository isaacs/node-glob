import t from 'tap'
import { Glob } from '../src/index.js'

const pattern =
  '{*z,x*y/z*,a*b*}' +
  '{*z,x*y/z*,a*b*}' +
  '{*z,x*y/z*,a*b*}' +
  '{*z,x*y/z*,a*b*}' +
  '{*z,x*y/z*,a*b*}' +
  '{*z,x*y/z*,a*b*}' +
  '{*z,x*y/z*,a*b*}' +
  '{*z,x*y/z*,a*b*}' +
  '{*z,x*y/z*,a*b*}' +
  '{*z,x*y/z*,a*b*}'

t.test('does not oom on long glob', async t => {
  const g = new Glob(pattern, { braceExpandMax: 1_000 })
  const results = await g.walk()

  t.pass('did not run out of memory')
  t.equal(results.length, 0, 'should not find anything')
})
