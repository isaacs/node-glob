var g = require("../lib/glob")

process.chdir(__dirname)

var failures = 0

function testSync(pattern, flags) {
  console.error("testing: %j %j", pattern, flags)
  console.error(g.globSync(pattern, flags))
}
try {
  testSync("*", 0)
  testSync("*/*.js", 0)
  testSync("lib/*", 0)
  testSync("~/*", g.GLOB_TILDE)
  testSync("foo/**/bar")
} catch (ex) {
  console.error(ex.stack)
  failures ++
}

function testAsync (pattern, flags, cb) {
  if (!cb) cb = flags, flags = undefined
  console.error("testing async: %j %j", pattern, flags)
  g.glob(pattern, flags, function (er, m) {
    if (er) {
      console.error(" FAIL: "+(er.stack||er.message))
      failures ++
    } else console.error("  %j", m)
    cb()
  })
}

function testAsyncList (list, cb) {
  next()
  function next (er, m) {
    var test = list.shift()
    if (!test) return cb()
    test.push(cb)
    testAsync.apply(null, test)
  }
}

testAsyncList
  ([["*", 0]
   ,["../*/*.js", 0]
   ,["../lib/*", 0]
   ,["~/*", g.GLOB_DEFAULT | g.GLOB_TILDE]
   ,["foo/**/bar"]
   ]
  ,testFnmatch)

function f (pattern, str, flags, expect) {
  if (arguments.length === 3) expect = flags, flags = undefined
  var actual = g.fnmatch(pattern, str, flags)
  if (actual !== expect) {
    console.error("Fail: "+JSON.stringify([pattern,str,flags]) + " expected "+expect + " actual "+actual)
    failures ++
  }
  console.error("%s, %s, %s => %j", pattern, str, flags, expect)
}

function testFnmatch () {
  f("*", "foo", true)
  f(".*", "foo", false)
  f("*", ".foo", false)
  f("*", "foo/bar", false)
  f("*/*", "foo/bar", true)
  f("*", ".foo", g.FNM_DEFAULT & ~g.FNM_PERIOD, true)
  f("*/*", "foo/bar", g.FNM_DEFAULT & ~g.FNM_PATHNAME, true)
  f("**/bar", "foo/bar", true)
  f("**/bar", "foo/baz/bar", true)
  f("foo/**/bar", "foo/bar/baz/quux/bar", true)
  done()
}

function done () {
  if (failures === 0) console.log("ok")
  else {
    console.error("Failures: %j", failures)
    process.exit(failures)
  }
}
