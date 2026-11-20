import { Glob } from '../dist/esm/index.js'
import { assert, test } from 'ubqtest'
test('absolute and withFileTypes together throw', () => {
  assert.throws(() => {
    new Glob('.', {
      withFileTypes: true,
      absolute: true,
    })
  }, Error)
})
