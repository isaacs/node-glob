import t from 'tap'
import { globSync } from '../dist/esm/index.js'

// just a rudimentary test, since PathScurry tests it more anyway
import { readdirSync } from 'fs'
let readdirCalled = 0
const myReaddirSync = (path: string, options: { withFileTypes: true }) => {
  readdirCalled++
  return readdirSync(path, options)
}

const cwd = t.testdir({
  a: '',
  b: '',
  c: {},
})

t.same(
  new Set(['a', 'b', 'c', '.']),
  new Set(
    globSync('**', {
      fs: {
        readdirSync: myReaddirSync,
      },
      cwd,
    })
  )
)

t.equal(readdirCalled, 2)
