require("./global-leakage.js")
var fs = require('fs')
const t = require('tap')
var glob = require('../');

var cwd = process.cwd()
var drive = 'c'
if (/^[a-zA-Z]:[\\\/]/.test(cwd)) {
  drive = cwd.charAt(0).toLowerCase()
}

t.before(() => {
  var stat = fs.stat
  var statSync = fs.statSync
  var readdir = fs.readdir
  var readdirSync = fs.readdirSync

  function fakeStat(path) {
    var ret
    switch (path.toLowerCase().replace(/\\/g, '/')) {
      case '/tmp': case '/tmp/': case drive+':\\tmp': case drive+':\\tmp\\':
        ret = { isDirectory: function() { return true } }
        break
      case '/tmp/a': case drive+':/tmp/a':
        ret = { isDirectory: function() { return false } }
        break
    }
    return ret
  }

  fs.stat = function(path, cb) {
    var f = fakeStat(path);
    if (f) {
      process.nextTick(function() {
        cb(null, f)
      })
    } else {
      stat.call(fs, path, cb)
    }
  }

  fs.statSync = function(path) {
    return fakeStat(path) || statSync.call(fs, path)
  }

  function fakeReaddir(path) {
    var ret
    switch (path.toLowerCase().replace(/\\/g, '/')) {
      case '/tmp': case '/tmp/': case drive+':/tmp': case drive+':/tmp/':
        ret = [ 'a', 'A' ]
        break
      case '/': case drive+':/':
        ret = ['tmp', 'tMp', 'tMP', 'TMP']
    }
    return ret
  }

  fs.readdir = function(path, cb) {
    var f = fakeReaddir(path)
    if (f)
      process.nextTick(function() {
        cb(null, f)
      })
    else
      readdir.call(fs, path, cb)
  }

  fs.readdirSync = function(path) {
    return fakeReaddir(path) || readdirSync.call(fs, path)
  }
})

t.test('nocase, nomagic', async t => {
  var want = [ '/TMP/A',
               '/TMP/a',
               '/tMP/A',
               '/tMP/a',
               '/tMp/A',
               '/tMp/a',
               '/tmp/A',
               '/tmp/a' ]
  if(process.platform.match(/^win/)) {
    want = want.map(function(p) {
      return drive+':' + p
    })
  }
  {
    let res = await glob('/tmp/a', { nocase: true })
    if (process.platform.match(/^win/))
      res = res.map(function (r) {
        return r.replace(/\\/g, '/').replace(new RegExp('^' + drive + ':', 'i'), drive+':')
      })
    t.same(res.sort(), want)
  }
  {
    let res = await glob('/tmp/A', { nocase: true })
    if (process.platform.match(/^win/))
      res = res.map(function (r) {
        return r.replace(/\\/g, '/').replace(new RegExp('^' + drive + ':', 'i'), drive+':')
      })
    t.same(res.sort(), want)
  }
})

t.test('nocase, with some magic', async t => {
  t.plan(2)
  var want = [ '/TMP/A',
               '/TMP/a',
               '/tMP/A',
               '/tMP/a',
               '/tMp/A',
               '/tMp/a',
               '/tmp/A',
               '/tmp/a' ]
  if(process.platform.match(/^win/)) {
    want = want.map(function(p) {
      return drive + ':' + p
    })
  }

  {
    let res = await glob('/tmp/*', { nocase: true })
    if (process.platform.match(/^win/)) {
      res = res.map(function (r) {
        return r.replace(/\\/g, '/').replace(new RegExp('^' + drive + ':', 'i'), drive+':')
      })
    }
    t.same(res.sort(), want)
  }

  {
    let res = await glob('/tmp/*', { nocase: true })
    if (process.platform.match(/^win/)) {
      res = res.map(function (r) {
        return r.replace(/\\/g, '/').replace(new RegExp('^' + drive + ':', 'i'), drive+':')
      })
    }
    t.same(res.sort(), want)
  }
})
