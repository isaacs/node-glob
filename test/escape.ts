import t from 'tap'
import { unescape, escape, hasMagic } from '../dist/esm/index.js'
import { bashResults } from './bash-results.js'

for (const pattern of Object.keys(bashResults)) {
  t.notOk(hasMagic(escape(pattern)), `escape(${pattern})`)
  const pp = escape(pattern)
  const pw = escape(pattern, {
    windowsPathsNoEscape: true,
  })
  t.notOk(
    hasMagic(pp, { platform: 'linux' }),
    'no magic after posix escape'
  )
  t.notOk(
    hasMagic(pw, { platform: 'win32', windowsPathsNoEscape: true }),
    'no magic after windows escape'
  )
  const up = unescape(pp)
  const uw = unescape(pw, { windowsPathsNoEscape: true })
  t.equal(up, pattern, 'unescaped posix pattern returned')
  t.equal(uw, pattern, 'unescaped windows pattern returned')
}
