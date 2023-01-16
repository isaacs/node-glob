require("./global-leakage.js")
var Glob = require('../glob.js').Glob;
var test = require('tap').test;
var f = __filename.replace(/\\/g, '/')

test('new glob, with cb, and no options', function (t) {
  new Glob(f, function(er, results) {
    if (er) throw er;
    t.same(results, [f]);
    t.end();
  });
});
