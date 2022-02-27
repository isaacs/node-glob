// just a little pre-run script to set up the fixtures.
// zz-finish cleans it up

require("./global-leakage.js")
var mkdirp = require("mkdirp")
var path = require("path")
var i = 0
process.env.TAP_BAIL = '1'
var tap = require("tap")
var fs = require("fs")
tap.pipe(fs.createWriteStream(path.resolve(__dirname, '../00-setup.tap')))
var rimraf = require("rimraf")

var fixtureDir = path.resolve(__dirname, 'fixtures')

var files =
[ "a/.abcdef/x/y/z/a"
, "a/abcdef/g/h"
, "a/abcfed/g/h"
, "a/b/c/d"
, "a/bc/e/f"
, "a/c/d/c/b"
, "a/cb/e/f"
, "a/x/.y/b"
, "a/z/.y/b"
]

var symlinkTo = path.resolve(fixtureDir, "a/symlink/a/b/c")
var symlinkFrom = "../.."

files = files.map(function (f) {
  return path.resolve(fixtureDir, f)
})

tap.test("remove fixtures", function (t) {
  rimraf.sync(fixtureDir)
  t.end()
})

files.forEach(function (f) {
  tap.test(f, function (t) {
    f = path.resolve(fixtureDir, f)
    var d = path.dirname(f)
    mkdirp(d, '0755', function (er) {
      if (er) {
        t.fail(er)
        return t.bailout()
      }
      fs.writeFile(f, "i like tests", function (er) {
        t.error(er, "make file")
        t.end()
      })
    })
  })
})

if (process.platform !== "win32") {
  tap.test("symlinky", function (t) {
    var d = path.dirname(symlinkTo)
    mkdirp(d, '0755', function (er) {
      if (er)
        throw er
      fs.symlinkSync(symlinkFrom, symlinkTo, "dir")
      t.end()
    })
  })
}

;["foo","bar","baz","asdf","quux","qwer","rewq"].forEach(function (w) {
  w = "/tmp/glob-test/" + w
  tap.test("create " + w, function (t) {
    mkdirp(w, function (er) {
      if (er)
        throw er
      t.pass(w)
      t.end()
    })
  })
})

// generate the bash pattern test-fixtures if possible
if (process.platform === "win32" || !process.env.TEST_REGEN) {
  console.error("Windows, or TEST_REGEN unset.  Using cached fixtures.")
  return
}

var spawn = require("child_process").spawn;
var globs =
  // put more patterns here.
  // anything that would be directly in / should be in /tmp/glob-test
  ["a/*/+(c|g)/./d"
  ,"a/**/[cg]/../[cg]"
  ,"a/{b,c,d,e,f}/**/g"
  ,"a/b/**"
  ,"./**/g"
  ,"a/abc{fed,def}/g/h"
  ,"a/abc{fed/g,def}/**/"
  ,"a/abc{fed/g,def}/**///**/"
  ,"./**/a/**/"
  ,"+(a|b|c)/a{/,bc*}/**"
  ,"*/*/*/f"
  ,"./**/f"
  ,"a/symlink/a/b/c/a/b/c/a/b/c//a/b/c////a/b/c/**/b/c/**"
  ,"{./*/*,/tmp/glob-test/*}"
  ,"{/tmp/glob-test/*,*}" // evil owl face!  how you taunt me!
  ,"a/!(symlink)/**"
  ,"a/symlink/a/**/*"
  ]
var bashOutput = {}
var fs = require("fs")

globs.forEach(function (pattern) {
  tap.test("generate fixture " + pattern, function (t) {
    var opts = [
      "-O", "globstar",
      "-O", "extglob",
      "-O", "nullglob",
      "-c",
      "for i in " + pattern + "; do echo $i; done"
    ]
    var cp = spawn("bash", opts, { cwd: fixtureDir })
    var out = []
    cp.stdout.on("data", function (c) {
      out.push(c)
    })
    cp.stderr.pipe(process.stderr)
    cp.on("close", function (code) {
      out = flatten(out)
      if (!out)
        out = []
      else
        out = cleanResults(out.split(/\r*\n/))

      bashOutput[pattern] = out
      t.notOk(code, "bash test should finish nicely")
      t.end()
    })
  })
})

tap.test("save fixtures", function (t) {
  var fname = path.resolve(__dirname, "bash-results.json")
  var data = JSON.stringify(bashOutput, null, 2) + "\n"
  fs.writeFile(fname, data, function (er) {
    t.error(er)
    t.end()
  })
})

function cleanResults (m) {
  // normalize discrepancies in ordering, duplication,
  // and ending slashes.
  return m.map(function (m) {
    return m.replace(/\/+/g, "/").replace(/\/$/, "")
  }).sort(alphasort).reduce(function (set, f) {
    if (f !== set[set.length - 1]) set.push(f)
    return set
  }, []).sort(alphasort).map(function (f) {
    // de-windows
    return (process.platform !== 'win32') ? f
           : f.replace(/^[a-zA-Z]:\\\\/, '/').replace(/\\/g, '/')
  })
}

function flatten (chunks) {
  var s = 0
  chunks.forEach(function (c) { s += c.length })
  var out = new Buffer(s)
  s = 0
  chunks.forEach(function (c) {
    c.copy(out, s)
    s += c.length
  })

  return out.toString().trim()
}

function alphasort (a, b) {
  a = a.toLowerCase()
  b = b.toLowerCase()
  return a > b ? 1 : a < b ? -1 : 0
}
