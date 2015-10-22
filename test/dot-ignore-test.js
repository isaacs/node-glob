require("./global-leakage.js")
// Negation test
// Show that glob respect's minimatch's negate flag

var glob = require('../glob.js')
var test = require('tap').test

process.chdir(__dirname + '/fixtures')

test('ignore and dot option', function(t) {
  var expect = ['.abcdef', '.abcdef/x', '.abcdef/x/y', '.abcdef/x/y/z', '.abcdef/x/y/z/b']
  var opt = { cwd: 'a', dot:true, ignore: ['**/a'] }

  var results = glob('.abcdef/**', opt, function (er, results) {
    if (er) throw er
      
    t.same(results, expect)
    t.end()
  });
});
