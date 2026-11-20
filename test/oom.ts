import { assert, test } from 'ubqtest'
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

test('does not oom on long glob', async () => {
  const g = new Glob(pattern, { braceExpandMax: 1_000 })
  const results = await g.walk()

  assert(true, 'did not run out of memory')
  assert.equal(results.length, 0, 'should not find anything')
})
