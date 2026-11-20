import { assert, test } from 'ubqtest'
import { glob } from '../dist/esm/index.js'

// Patterns that cannot match anything
const patterns = [
  '# comment',
  ' ',
  '\n',
  'just doesnt happen to match anything so this is a control',
]

for (const p of patterns) {
  test(JSON.stringify(p), async () => {
    const f = await glob(p)
    assert.deepEqual(f, [], 'no returned values')
  })
}
