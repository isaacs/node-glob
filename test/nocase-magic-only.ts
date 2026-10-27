import t from 'tap'
import { Glob } from '../dist/esm/index.js'

const darwin = new Glob('x', { nocase: true, platform: 'darwin' })
const linux = new Glob('x', { nocase: true, platform: 'linux' })

t.type(darwin.patterns[0]?.pattern(), 'string')
// a portion with magic is a Matcher
t.type(linux.patterns[0]?.pattern(), 'object')
t.equal(linux.patterns[0]?.isMatcher(), true)
