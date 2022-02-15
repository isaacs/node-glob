// regression test to make sure that slash-ended patterns
// don't match files when using a different cwd.
var glob = require('../')
var test = require('tap').test
var pattern = '../{*.md,test}/'
var expect = [ '../test/' ]
var cwd = __dirname
var opt = { cwd: cwd }
process.chdir(__dirname + '/..')

test('slashes only match directories', async t => {
  var sync = glob.sync(pattern, { cwd })
  t.same(sync, expect, 'sync test')
  const res = await glob(pattern, { cwd })
  t.same(res, expect, 'async test')
})
