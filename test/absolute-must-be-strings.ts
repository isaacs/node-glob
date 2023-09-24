import { Glob } from '../dist/esm/index.js'
import t from 'tap'
t.throws(() => {
  new Glob('.', {
    withFileTypes: true,
    absolute: true,
  })
})
