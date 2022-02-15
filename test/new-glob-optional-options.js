require("./global-leakage.js")
var Glob = require('../').Glob;
var test = require('tap').test;
var f = __filename.replace(/\\/g, '/')

test('new glob, with cb, and no options', async t =>
  t.strictSame(await new Glob(f).results, [f]))
