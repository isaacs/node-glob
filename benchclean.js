var rimraf = require('rimraf')
var bf = (process.env.TMPDIR || '/tmp') + '/benchmark-fixture'
rimraf.sync(bf)
