var test = require('tap').test
var path = require('path')
var os = require('os')

var uncRoot = '\\\\' + os.hostname() + '\\glob-test'
var localRoot = path.resolve(__dirname, 'fixtures/a')
var windowsRoot = localRoot

function mockMinimatchForWin32() {
  var minimatch = require('minimatch')
  var OriginalMinimatch = minimatch.Minimatch
  minimatch.Minimatch = function Minimatch(pattern, options) {
    if (!(this instanceof Minimatch))
      return new Minimatch(pattern, options)

    var mm = new OriginalMinimatch(pattern.replace(/\\/g, '/'), options)
    this.pattern = mm.pattern
    this.options = mm.options
    this.set = mm.set
    this.regexp = mm.regexp
    this.negate = mm.negate
    this.comment = mm.comment
    this.empty = mm.empty
    this.makeRe = mm.makeRe
    this.match = mm.match
    this.matchOne = mm.matchOne
  }
}

function mockResolveForWin32() {
  var originalResolve = path.resolve
  path.resolve = function() {
    var args = arguments
    if (args[0].indexOf(uncRoot) === 0) {
      args[0] = args[0].replace(uncRoot, localRoot).replace(/\\/g, '/')
    } else if (args[0].indexOf('C:\\') === 0) {
      args[0] = args[0].replace('C:\\', '/').replace(/\\/g, '/')
    }
    return originalResolve.apply(path, args)
  }
}

function mockProcessPlatformForWin32() {
  Object.defineProperty(process, 'platform', { value: 'win32' })
}

var mockingWin32 = process.platform !== 'win32'
if (mockingWin32) {
  windowsRoot = 'C:' + localRoot.replace(/\//g, '\\')
  mockMinimatchForWin32()
  mockResolveForWin32()
}
var glob = require('../glob.js')
if (mockingWin32) {
  mockProcessPlatformForWin32()
}

test('glob doesn\'t choke on UNC paths', function(t) {
  var expect = [uncRoot + '\\c', uncRoot + '\\cb']

  var results = glob(uncRoot + '\\c*', function (er, results) {
    if (er)
      throw er

    var uncResults = results.map(function (result) { return result.replace(localRoot, uncRoot).replace(/\//g, '\\') })
    t.same(uncResults, expect)
    t.end()
  })
})

test('can match abs paths on Windows with nocase', function(t) {
  var testPath = path.resolve(__dirname, "fixtures/a/b/c/d")
  glob(windowsRoot + '\\**\\b\\c\\d', {nocase: true}, function (err, match) {
    t.same(match, [testPath])
    t.end()
  })
})
