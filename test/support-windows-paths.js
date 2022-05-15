require('./global-leakage.js')
var test = require('tap').test
var glob = require('../')
var bashResults = require('./bash-results.json')
process.chdir(__dirname + '/fixtures')

var processedResults = Object.keys(bashResults).reduce(
  (acc, val) =>
    !val.includes('symlink')
      ? [
          ...acc,
          [val, glob.sync(val).filter((val) => !val.includes('symlink'))],
        ]
      : acc,
  []
)

var bothSlashes = '\\/'

function forEachSlashPattern(originalPattern, cb) {
  for (var slashPattern of ['/', '\\', bothSlashes]) {
    var newPattern = originalPattern
    if (slashPattern === bothSlashes) {
      const patternParts = originalPattern.split('/')
      newPattern = ''

      patternParts.forEach((val, valIndexInArr, { length: arrLength }) => {
        newPattern += val
        // arrLength is one plus the index of the last element
        // using return since there will be no more iterations to go through if the expression is true
        if (valIndexInArr === arrLength - 1) return
        // the separators should always alternate between forward and backward slashes
        newPattern += valIndexInArr % 2 === 0 ? '/' : '\\'
      })
    } else {
      newPattern = originalPattern.split('/').join(slashPattern)
    }

    cb(newPattern, slashPattern)
  }
}

// testing symlinks is outside of the scope of this test
test('support windows paths as a config option', (t) => {
  processedResults.forEach(([originalPattern, expectedResults]) => {
    forEachSlashPattern(originalPattern, (pattern, slashPattern) => {
      t.strictSame(
        glob.sync(pattern, { supportWindowsPaths: true })
          .filter((val) => !val.includes('symlink'))
          .sort(),
        expectedResults.sort(),
        `${originalPattern} correctly evaluates with ${
          slashPattern === bothSlashes
            ? 'both separators'
            : `${slashPattern} separator`
        }, pattern is ${pattern}`
      )
    })
  })
  t.end()
})
