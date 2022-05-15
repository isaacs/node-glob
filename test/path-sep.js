require("./global-leakage.js")
var t = require("tap")
var glob = require("../")
var bashResults = require("./bash-results.json")
process.chdir(__dirname + "/fixtures")

var processedResults = Object.keys(bashResults).reduce(
  (acc, val) => [...acc, [val, glob.sync(val)]],
  []
)

;["/", "\\", "<>", "sep"].forEach((sep) => {
  processedResults.forEach(([originalPattern, expectedResults]) => {
    var pattern = originalPattern.split("/").join(sep)

    glob(pattern, { pathsep: sep }, (err, matches) => {
      if (err) t.fail(err.message)

      // testing symlinks is completely unpredictable cross-platform, remove everything to do with symlinks
      matches = matches.filter((val) => !val.includes("symlink"))
      expectedResults = expectedResults.filter((val) => !val.includes("symlink"))

      t.strictSame(
        matches.sort(),
        expectedResults.sort(),
        `${originalPattern} matches with separator ${sep}`
      )
    })
  })
})
