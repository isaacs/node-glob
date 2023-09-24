import t from 'tap'
import { Glob } from '../dist/esm/index.js'

const darwin = new Glob('x', { nocase: true, platform: 'darwin' })
const linux = new Glob('x', { nocase: true, platform: 'linux' })

t.type(darwin.patterns[0]?.pattern(), 'string')
t.type(linux.patterns[0]?.pattern(), RegExp)
