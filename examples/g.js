var Glob = require('../').Glob

var pattern = 'test/a/**/[cg]/../[cg]'
console.log(pattern)

new Glob(pattern, {mark: true, sync: true}, function (er, matches) { // eslint-disable-line
  console.log('matches', matches)
})
console.log('after')
