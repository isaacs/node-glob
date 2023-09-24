import t from 'tap'
import { glob } from '../dist/esm/index.js'

// Patterns that cannot match anything
const patterns = [
  '# comment',
  ' ',
  '\n',
  'just doesnt happen to match anything so this is a control',
]

t.plan(patterns.length)
for (const p of patterns) {
  t.test(JSON.stringify(p), async t => {
    const f = await glob(p)
    t.same(f, [], 'no returned values')
  })
}
