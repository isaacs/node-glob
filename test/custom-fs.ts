import { assert, test, testdir } from 'ubqtest'
import { globSync } from '../dist/esm/index.js'

// just a rudimentary test, since PathScurry tests it more anyway
import { readdirSync } from 'fs'
test('a custom fs.readdirSync is used', () => {
  let readdirCalled = 0
  const myReaddirSync = (
    path: string,
    options: { withFileTypes: true },
  ) => {
    readdirCalled++
    return readdirSync(path, options)
  }

  const cwd = testdir({
    a: '',
    b: '',
    c: {},
  })

  assert.deepEqual(
    new Set(['a', 'b', 'c', '.']),
    new Set(
      globSync('**', {
        fs: {
          readdirSync: myReaddirSync,
        },
        cwd,
      }),
    ),
  )

  assert.equal(readdirCalled, 2)
})
