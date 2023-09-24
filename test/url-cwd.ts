import t from 'tap'
import { pathToFileURL } from 'url'
import { Glob } from '../dist/esm/index.js'

t.test('can use file url as cwd option', t => {
  const fileURL = pathToFileURL(process.cwd())
  const fileURLString = String(fileURL)
  const ps = new Glob('.', { cwd: process.cwd() })
  const pu = new Glob('.', { cwd: fileURL })
  const pus = new Glob('.', { cwd: fileURLString })
  t.equal(ps.cwd, process.cwd())
  t.equal(pu.cwd, process.cwd())
  t.equal(pus.cwd, process.cwd())
  t.end()
})
