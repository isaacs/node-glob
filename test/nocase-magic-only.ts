import { assert, test } from 'ubqtest'
import { Glob } from '../dist/esm/index.js'

test('nocase makes a Matcher only on a case-sensitive platform', () => {
  const darwin = new Glob('x', { nocase: true, platform: 'darwin' })
  const linux = new Glob('x', { nocase: true, platform: 'linux' })

  assert.equal(typeof darwin.patterns[0]?.pattern(), 'string')
  // a portion with magic is a Matcher
  assert.equal(typeof linux.patterns[0]?.pattern(), 'object')
  assert.equal(linux.patterns[0]?.isMatcher(), true)
})
