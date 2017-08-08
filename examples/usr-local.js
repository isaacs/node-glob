var Glob = require('../').Glob

var pattern = '{./*/*,/*,/usr/local/*}'
console.log(pattern)

new Glob(pattern, {mark: true}, function (er, matches) { // eslint-disable-line
  console.log('matches', matches)
})
console.log('after')
