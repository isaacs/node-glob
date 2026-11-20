import { assert, test } from 'ubqtest'
import './00-setup.js'
import { unescape, escape, hasMagic } from '../dist/esm/index.js'
import { bashResults } from './bash-results.js'

test('escape and unescape of the bash patterns', () => {
  for (const pattern of Object.keys(bashResults)) {
    assert(!hasMagic(escape(pattern)), `escape(${pattern})`)
    const pp = escape(pattern)
    const pw = escape(pattern, {
      windowsPathsNoEscape: true,
    })
    assert(
      !hasMagic(pp, { platform: 'linux' }),
      'no magic after posix escape',
    )
    assert(
      !hasMagic(pw, { platform: 'win32', windowsPathsNoEscape: true }),
      'no magic after windows escape',
    )
    const up = unescape(pp)
    const uw = unescape(pw, { windowsPathsNoEscape: true })
    assert.equal(up, pattern, 'unescaped posix pattern returned')
    assert.equal(uw, pattern, 'unescaped windows pattern returned')
  }
})
