import { assert, test } from 'ubqtest'
import { pathToFileURL } from 'url'
import { Glob } from '../dist/esm/index.js'

test('can use file url as cwd option', () => {
  const fileURL = pathToFileURL(process.cwd())
  const fileURLString = String(fileURL)
  const ps = new Glob('.', { cwd: process.cwd() })
  const pu = new Glob('.', { cwd: fileURL })
  const pus = new Glob('.', { cwd: fileURLString })
  assert.equal(ps.cwd, process.cwd())
  assert.equal(pu.cwd, process.cwd())
  assert.equal(pus.cwd, process.cwd())
})
