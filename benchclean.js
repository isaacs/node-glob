var rimraf = require('rimraf')
var bf = (process.env.TMPDIR || '/tmp') + '/benchmark-fixture'
rimraf('{' + [bf, 'v8.log', 'profile.txt'].join(',') + '}', function (er) {
  if (er)
    throw er
})
