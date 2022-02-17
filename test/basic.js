const t = require('tap')
const glob = require('../')
const {Glob, GlobSync} = glob
const {resolve} = require('path')
t.throws(() => new Glob('*', 1234))
const ca = new Glob('*', { cwd: 'fixtures' })
t.equal(ca.cwd, resolve('fixtures'))
t.throws(() => ca.write())
t.throws(() => ca.end())
t.test('get results multiple times', async t => {
  const g = new Glob('*', { cwd: __dirname + '/fixtures' })
  const r1 = await g.results
  const r2 = await g.results
  const r3 = await g.results
  t.equal(r1, r2)
  t.equal(r2, r3)

  const gs = new GlobSync('*', { cwd: __dirname + '/fixtures' })
  const sr1 = gs.results
  const sr2 = gs.results
  const sr3 = gs.results
  t.equal(sr1, sr2)
  t.equal(sr2, sr3)
})
