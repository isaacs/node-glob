module.exports = globSync
globSync.GlobSync = GlobSync

var fs = require("fs")
var minimatch = require("minimatch")
var Minimatch = minimatch.Minimatch
var Glob = require("./glob.js").Glob
var util = require("util")
var path = require("path")
var assert = require("assert")
var common = require("./common.js")
var alphasort = common.alphasort
var alphasorti = common.alphasorti
var isAbsolute = common.isAbsolute

function ownProp (obj, field) {
  return Object.prototype.hasOwnProperty.call(obj, field)
}

function globSync (pattern, options) {
  return new GlobSync(pattern, options).found
}

function GlobSync (pattern, options) {
  if (!pattern)
    throw new Error("must provide pattern")

  if (!options)
    options = { sync: true }
  else
    options.sync = true

  if (!(this instanceof GlobSync))
    return new GlobSync(pattern, options)

  // base-matching: just use globstar for that.
  if (options.matchBase && -1 === pattern.indexOf("/")) {
    if (options.noglobstar) {
      throw new Error("base matching requires globstar")
    }
    pattern = "**/" + pattern
  }

  this.strict = options.strict !== false
  this.dot = !!options.dot
  this.mark = !!options.mark
  this.sync = !!options.sync
  this.nounique = !!options.nounique
  this.nonull = !!options.nonull
  this.nosort = !!options.nosort
  this.nocase = !!options.nocase
  this.stat = !!options.stat
  this.maxLength = options.maxLength || Infinity
  this.cache = options.cache || {}
  this.statCache = options.statCache || {}

  this.changedCwd = false
  var cwd = process.cwd()
  if (!ownProp(options, "cwd"))
    this.cwd = cwd
  else {
    this.cwd = options.cwd
    this.changedCwd = path.resolve(options.cwd) !== cwd
  }

  this.root = options.root || path.resolve(this.cwd, "/")
  this.root = path.resolve(this.root)
  if (process.platform === "win32")
    this.root = this.root.replace(/\\/g, "/")

  this.nomount = !!options.nomount

  var mm = this.minimatch = new Minimatch(pattern, options)
  this.options = mm.options

  var n = mm.set.length
  this.matches = new Array(n)
  for (var i = 0; i < n; i ++) {
    this._process(mm.set[i], i, false)
  }
  this._finish()
}

GlobSync.prototype._finish = function () {
  assert(this instanceof GlobSync)

  var nou = this.nounique
  var all = nou ? [] : Object.create(null)

  for (var i = 0, l = this.matches.length; i < l; i ++) {
    var matches = this.matches[i]
    if (!matches) {
      if (this.nonull) {
        // do like the shell, and spit out the literal glob
        var literal = this.minimatch.globSet[i]
        if (nou)
          all.push(literal)
        else
          all[literal] = true
      }
    } else {
      // had matches
      var m = Object.keys(matches)
      if (nou)
        all.push.apply(all, m)
      else
        m.forEach(function (m) {
          all[m] = true
        })
    }
  }

  if (!nou)
    all = Object.keys(all)

  if (!this.nosort)
    all = all.sort(this.nocase ? alphasorti : alphasort)

  // at *some* point we statted all of these
  if (this.mark)
    all = all.map(this._mark, this)

  this.found = all
}


GlobSync.prototype._process = function (pattern, index, inGlobStar) {
  assert(this instanceof GlobSync)

  // Get the first [n] parts of pattern that are all strings.
  var n = 0
  while (typeof pattern[n] === "string") {
    n ++
  }
  // now n is the index of the first one that is *not* a string.

  // See if there's anything else
  var prefix
  switch (n) {
    // if not, then this is rather simple
    case pattern.length:
      this._processSimple(pattern.join('/'), index)
      return

    case 0:
      // pattern *starts* with some non-trivial item.
      // going to readdir(cwd), but not include the prefix in matches.
      prefix = null
      break

    default:
      // pattern has some string bits in the front.
      // whatever it starts with, whether that's "absolute" like /foo/bar,
      // or "relative" like "../baz"
      prefix = pattern.slice(0, n)
      prefix = prefix.join("/")
      break
  }

  var remain = pattern.slice(n)

  // get the list of entries.
  var read
  if (prefix === null) read = "."
  else if (isAbsolute(prefix) || isAbsolute(pattern.join("/"))) {
    if (!prefix || !isAbsolute(prefix))
      prefix = "/" + prefix
    read = prefix
  } else
    read = prefix

  var abs = this._makeAbs(read)

  var isGlobStar = remain[0] === minimatch.GLOBSTAR
  if (isGlobStar)
    this._processGlobStar(prefix, read, abs, remain, index, inGlobStar)
  else
    this._processReaddir(prefix, read, abs, remain, index, inGlobStar)
}

GlobSync.prototype._processReaddir = function (prefix, read, abs, remain, index, inGlobStar) {
  var entries = this._readdir(abs, inGlobStar)

  // if the abs isn't a dir, then nothing can match!
  if (!entries)
    return

  // It will only match dot entries if it starts with a dot, or if
  // dot is set.  Stuff like @(.foo|.bar) isn't allowed.
  var pn = remain[0]
  var negate = !!this.minimatch.negate
  var rawGlob = pn._glob
  var dotOk = this.dot || rawGlob.charAt(0) === "."

  var matchedEntries = []
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i]
    if (e.charAt(0) !== "." || dotOk) {
      var m
      if (negate && n === 0) {
        m = !e.match(pn)
      } else {
        m = e.match(pn)
      }
      if (m)
        matchedEntries.push(e)
    }
  }

  var len = matchedEntries.length
  // If there are no matched entries, then nothing matches.
  if (len === 0)
    return

  // if this is the last remaining pattern bit, then no need for
  // an additional stat *unless* the user has specified mark or
  // stat explicitly.  We know they exist, since readdir returned
  // them.

  if (remain.length === 1 && !this.mark && !this.stat) {
    if (!this.matches[index])
      this.matches[index] = Object.create(null)

    for (var i = 0; i < len; i ++) {
      var e = matchedEntries[i]
      if (prefix) {
        if (prefix !== "/")
          e = prefix + "/" + e
        else
          e = prefix + e
      }

      if (e.charAt(0) === "/" && !this.nomount) {
        e = path.join(this.root, e)
      }
      this.matches[index][e] = true
    }
    // This was the last one, and no stats were needed
    return
  }

  // now test all matched entries as stand-ins for that part
  // of the pattern.
  remain.shift()
  for (var i = 0; i < len; i ++) {
    var e = matchedEntries[i]
    var newPattern = [read, e].concat(remain)
    this._process(newPattern, index, inGlobStar)
  }
}



GlobSync.prototype._readdirInGlobStar = function (abs) {
  var entries
  var lstat
  var stat
  try {
    lstat = fs.lstatSync(abs)
  } catch (er) {
    // lstat failed, doesn't exist
    return null
  }

  if (lstat.isSymbolicLink()) {
    stat = this._stat(abs)
    if (stat === 'DIR')
      entries = []
  } else {
    // just normal readdir
    entries = this._readdir(abs)
  }

  return entries
}

GlobSync.prototype._readdir = function (abs, inGlobStar) {
  var entries

  if (inGlobStar)
    return this._readdirInGlobStar(abs)

  if (ownProp(this.cache, abs)) {
    c = this.cache[abs]
    if (!c || c === 'FILE')
      return null

    if (Array.isArray(c))
      return c
  }

  try {
    entries = fs.readdirSync(abs)
  } catch (er) {
    this._readdirError(abs, er)
    return null
  }

  // if we haven't asked to stat everything, then just
  // assume that everything in there exists, so we can avoid
  // having to stat it a second time.
  if (!this.mark && !this.stat) {
    for (var i = 0; i < entries.length; i ++) {
      var e = entries[i]
      if (abs === "/")
        e = abs + e
      else
        e = abs + "/" + e
      this.cache[e] = true
    }
  }

  this.cache[abs] = entries

  // mark and cache dir-ness
  return entries
}

GlobSync.prototype._readdirError = function (f, er) {
  // handle errors, and cache the information
  switch (er.code) {
    case "ENOTDIR": // totally normal. means it *does* exist.
      this.cache[f] = 'FILE'
      break

    case "ENOENT": // not terribly unusual
    case "ELOOP":
    case "ENAMETOOLONG":
    case "UNKNOWN":
      this.cache[f] = false
      break

    default: // some unusual error.  Treat as failure.
      this.cache[f] = false
      if (this.strict) throw er
      if (!this.silent) console.error("glob error", er)
      break
  }
}

GlobSync.prototype._processGlobStar = function (prefix, read, abs, remain, index, inGlobStar) {

  var entries = this._readdir(abs, inGlobStar)

  // no entries means not a dir, so it can never have matches
  // foo.txt/** doesn't match foo.txt
  if (!entries)
    return

  // test without the globstar, and with every child both below
  // and replacing the globstar.
  var remainWithoutGlobStar = remain.slice(1)
  var noGlobStar = [read].concat(remainWithoutGlobStar)

  // the noGlobStar pattern exits the inGlobStar state
  this._process(noGlobStar, index, false)

  var len = entries.length
  for (var i = 0; i < len; i++) {
    var e = entries[i]
    if (e.charAt(0) === "." && !this.dot)
      continue

    // these two cases enter the inGlobStar state
    var instead = [read, entries[i]].concat(remainWithoutGlobStar)
    var below = [read, entries[i]].concat(remain)

    this._process(instead, index, true)
    this._process(below, index, true)
  }
}

GlobSync.prototype._processSimple = function (prefix, index) {
  // XXX review this.  Shouldn't it be doing the mounting etc
  // before doing stat?  kinda weird?
  var exists = this._stat(prefix)

  if (!this.matches[index])
    this.matches[index] = Object.create(null)

  // If it doesn't exist, then just mark the lack of results
  if (!exists)
    return

  if (prefix && isAbsolute(prefix) && !this.nomount) {
    if (prefix.charAt(0) === "/") {
      prefix = path.join(this.root, prefix)
    } else {
      prefix = path.resolve(this.root, prefix)
    }
  }

  if (process.platform === "win32")
    prefix = prefix.replace(/\\/g, "/")

  // Mark this as a match
  this.matches[index][prefix] = true
}

// Returns either 'DIR', 'FILE', or false
GlobSync.prototype._stat = function (f) {
  var abs = f
  if (f.charAt(0) === "/")
    abs = path.join(this.root, f)
  else if (this.changedCwd)
    abs = path.resolve(this.cwd, f)


  if (f.length > this.maxLength)
    return false

  if (!this.stat && ownProp(this.cache, f)) {
    var c = this.cache[f]

    if (Array.isArray(c))
      c = 'DIR'

    // It exists, but not how we need it
    if (abs.slice(-1) === "/" && c !== 'DIR')
      return false

    return c
  }

  var exists
  var stat = this.statCache[abs]
  if (!stat) {
    try {
      stat = fs.statSync(abs)
    } catch (er) {
      return false
    }
  }

  this.statCache[abs] = stat

  if (abs.slice(-1) === "/" && !stat.isDirectory())
    return false

  var c = stat.isDirectory() ? 'DIR' : 'FILE'
  this.cache[f] = this.cache[f] || c
  return c
}

GlobSync.prototype._mark = function (p) {
  var c = this.cache[p]
  var m = p
  if (c) {
    var isDir = c === 'DIR' || Array.isArray(c)
    var slash = p.slice(-1) === '/'

    if (isDir && !slash)
      m += '/'
    else if (!isDir && slash)
      m = m.slice(0, -1)

    if (m !== p) {
      this.statCache[m] = this.statCache[p]
      this.cache[m] = this.cache[p]
    }
  }

  return m
}


// lotta situps...
GlobSync.prototype._makeAbs = function (f) {
  var abs = f
  if (f.charAt(0) === "/") {
    abs = path.join(this.root, f)
  } else if (isAbsolute(f)) {
    abs = f
  } else if (this.changedCwd) {
    abs = path.resolve(this.cwd, f)
  }
  return abs
}
