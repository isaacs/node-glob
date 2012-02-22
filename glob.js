// Approach:
//
// 1. Get the minimatch set
// 2. For each pattern in the set, PROCESS(pattern)
// 3. Store matches per-set, then uniq them
//
// PROCESS(pattern)
// Get the first [n] items from pattern that are all strings
// Join these together.  This is PREFIX.
//   If there is no more remaining, then stat(PREFIX) and
//   add to matches if it succeeds.  END.
// readdir(PREFIX) as ENTRIES
//   If fails, END
//   If pattern[n] is GLOBSTAR
//     // handle the case where the globstar match is empty
//     // by pruning it out, and testing the resulting pattern
//     PROCESS(pattern[0..n] + pattern[n+1 .. $])
//     // handle other cases.
//     for ENTRY in ENTRIES (not dotfiles)
//       // attach globstar + tail onto the entry
//       PROCESS(pattern[0..n] + ENTRY + pattern[n .. $])
//
//   else // not globstar
//     for ENTRY in ENTRIES (not dotfiles, unless pattern[n] is dot)
//       Test ENTRY against pattern[n+1]
//       If fails, continue
//       If passes, PROCESS(pattern[0..n] + item + pattern[n+1 .. $])
//
// Caveat:
//   Cache all stats and readdirs results to minimize syscall.  Since all
//   we ever care about is existence and directory-ness, we can just keep
//   `true` for files, and [children,...] for directories, or `false` for
//   things that don't exist.



module.exports = glob

var fs = require("graceful-fs")
, minimatch = require("minimatch")
, Minimatch = minimatch.Minimatch
, inherits = require("inherits")
, EE = require("events").EventEmitter
, path = require("path")
, isDir = {}

function glob (pattern, options, cb) {
  if (typeof options === "function") cb = options, options = {}
  if (!options) options = {}

  if (typeof options === "number") {
    deprecated()
    return
  }

  var m = new Glob(pattern, options, cb)

  if (options.sync) {
    return m.found
  } else {
    return m
  }
}

glob.fnmatch = deprecated

function deprecated () {
  throw new Error("glob's interface has changed. Please see the docs.")
}

glob.sync = globSync
function globSync (pattern, options) {
  if (typeof options === "number") {
    deprecated()
    return
  }

  options = options || {}
  options.sync = true
  return glob(pattern, options)
}


glob.Glob = Glob
inherits(Glob, EE)
function Glob (pattern, options, cb) {
  if (!(this instanceof Glob)) {
    return new Glob(pattern, options, cb)
  }

  if (typeof cb === "function") {
    console.error("cb is function")
    this.on("error", cb)
    this.on("end", function (matches) {
      // console.error("cb with matches", matches)
      cb(null, matches)
    })
  }

  options = options || {}

  if (!options.hasOwnProperty("maxDepth")) options.maxDepth = 1000
  if (!options.hasOwnProperty("maxLength")) options.maxLength = Infinity
  if (!options.hasOwnProperty("statCache")) options.statCache = {}
  if (!options.hasOwnProperty("cwd")) options.cwd = process.cwd()
  if (!options.hasOwnProperty("root")) {
    options.root = path.resolve(options.cwd, "/")
  }

  if (!pattern) {
    throw new Error("must provide pattern")
  }

  // base-matching: just use globstar for that.
  if (options.matchBase && -1 === pattern.indexOf("/")) {
    if (options.noglobstar) {
      throw new Error("base matching requires globstar")
    }
    pattern = "**/" + pattern
  }

  var mm = this.minimatch = new Minimatch(pattern, options)
  options = this.options = mm.options
  pattern = this.pattern = mm.pattern

  this.error = null
  this.aborted = false

  EE.call(this)

  // process each pattern in the minimatch set
  var n = this.minimatch.set.length

  // The matches are stored as {<filename>: true,...} so that
  // duplicates are automagically pruned.
  // Later, we do an Object.keys() on these.
  // Keep them as a list so we can fill in when nonull is set.
  this.matches = new Array(n)

  this.minimatch.set.forEach(iterator.bind(this))
  function iterator (pattern, i, set) {
    this._process(pattern, 0, i, function (er) {
      if (er) this.emit("error", er)
      if (-- n <= 0) this._finish()
    }.bind(this))
  }
}

Glob.prototype._finish = function () {

  var nou = this.options.nounique
  , all = nou ? [] : {}

  for (var i = 0, l = this.matches.length; i < l; i ++) {
    var matches = this.matches[i]
    // console.error("matches[%d] =", i, matches)
    // do like the shell, and spit out the literal glob
    if (!matches) {
      if (this.options.nonull) {
        var literal = this.minimatch.globSet[i]
        if (nou) all.push(literal)
        else nou[literal] = true
      }
    } else {
      // had matches
      var m = Object.keys(matches)
      if (nou) all.push.apply(all, m)
      else m.forEach(function (m) {
        all[m] = true
      })
    }
  }

  if (!nou) all = Object.keys(all)

  if (!this.options.nosort) {
    all = all.sort(this.options.nocase ? alphasorti : alphasort)
  }

  if (this.options.mark) {
    // at *some* point we statted all of these
    all = all.map(function (m) {
      var sc = this.statCache[m]
      if (!sc) return m
      if (m.slice(-1) !== "/" && (Array.isArray(sc) || sc === 2)) {
        return m + "/"
      }
      if (m.slice(-1) === "/") {
        return m.replace(/\/$/, "")
      }
      return m
    })
  }

  // console.error("emitting end", all)

  this.found = all
  this.emit("end", all)
}

function alphasorti (a, b) {
  a = a.toLowerCase()
  b = b.toLowerCase()
  return alphasort(a, b)
}

function alphasort (a, b) {
  return a > b ? 1 : a < b ? -1 : 0
}

Glob.prototype.abort = abort
function abort () {
  this.aborted = true
  this.emit("abort")
}


Glob.prototype._process = _process
function _process (pattern, depth, index, cb) {
  cb = cb.bind(this)
  if (this.aborted) return cb()

  if (depth > this.options.maxDepth) return cb()

  // Get the first [n] parts of pattern that are all strings.
  var n = 0
  while (typeof pattern[n] === "string") {
    n ++
  }
  // now n is the index of the first one that is *not* a string.

  // see if there's anything else
  switch (n) {
    // if not, then this is rather simple
    case pattern.length:
      var prefix = pattern.join("/")
      this._stat(prefix, function (exists, isDir) {
        // either it's there, or it isn't.
        // nothing more to do, either way.
        if (exists) {
          this.matches[index] = this.matches[index] || {}
          this.matches[index][prefix] = true
          this.emit("match", prefix)
        }
        return cb()
      })
      return

    case 0:
      // pattern *starts* with some non-trivial item.
      // going to readdir(cwd), but not include the prefix in matches.
      var prefix = null
      break

    default:
      // pattern has some string bits in the front.
      // whatever it starts with, whether that's "absolute" like /foo/bar,
      // or "relative" like "../baz"
      var prefix = pattern.slice(0, n)
      prefix = prefix.join("/")
      // console.error("prefix=%s", prefix)
      break
  }

  // get the list of entries.
  if (prefix !== null && (prefix.charAt(0) === "/" || prefix === "")) {
    prefix = path.join(this.options.root, prefix)
  }
  var read = prefix || this.options.cwd
  return this._readdir(prefix || process.cwd(), function (er, entries) {
    // console.error("back from readdir", prefix || process.cwd(), er, entries)
    if (er) {
      // not a directory!
      // this means that, whatever else comes after this, it can never match
      return cb()
    }

    // globstar is special
    if (pattern[n] === minimatch.GLOBSTAR) {
      // console.error("globstar!", pattern, n)
      // console.error("entries", prefix, entries)
      // test without the globstar, and with every child both below
      // and replacing the globstar.
      var s = [ pattern.slice(0, n).concat(pattern.slice(n + 1)) ]
      entries.forEach(function (e) {
        if (e.charAt(0) === "." && !this.options.dot) return
        // instead of the globstar
        s.push(pattern.slice(0, n).concat(e).concat(pattern.slice(n + 1)))
        // below the globstar
        s.push(pattern.slice(0, n).concat(e).concat(pattern.slice(n)))
      }, this)

      // now asyncForEach over this
      var l = s.length
      , errState = null
      s.forEach(function (gsPattern) {
        this._process(gsPattern, depth + 1, index, function (er) {
          if (errState) return
          if (er) return cb(errState = er)
          if (--l <= 0) return cb()
        })
      }, this)

      return
    }

    // not a globstar
    // It will only match dot entries if it starts with a dot, or if
    // options.dot is set.  Stuff like @(.foo|.bar) isn't allowed.
    var pn = pattern[n]
    if (typeof pn === "string") {
      var found = entries.indexOf(pn) !== -1
      entries = found ? entries[pn] : []
    } else {
      var rawGlob = pattern[n]._glob
      , dotOk = this.options.dot || rawGlob.charAt(0) === "."

      // console.error("pattern", pattern, n, pattern[n])
      entries = entries.filter(function (e) {
        return (e.charAt(0) !== "." || dotOk) &&
               (typeof pattern[n] === "string" && e === pattern[n] ||
                e.match(pattern[n]))
      })
    }

    // If n === pattern.length - 1, then there's no need for the extra stat
    // *unless* the user has specified "mark" or "stat" explicitly.
    // We know that they exist, since the readdir returned them.
    if (n === pattern.length - 1 &&
        !this.options.mark &&
        !this.options.stat) {
      console.error("skip final stat")
      entries.forEach(function (e) {
        if (prefix) {
          if (prefix !== "/") e = prefix + "/" + e
          else e = prefix + e
        }
        this.matches[index] = this.matches[index] || {}
        this.matches[index][e] = true
        this.emit("match", e)
      }, this)
      return cb.call(this)
    }



    // console.error("entries", prefix, entries)

    // now test all the remaining entries as stand-ins for that part
    // of the pattern.
    var l = entries.length
    , errState = null
    if (l === 0) return cb() // no matches possible
    entries.forEach(function (e) {
      var p = pattern.slice(0, n).concat(e).concat(pattern.slice(n + 1))
      // console.error("new pattern!", p)
      this._process(p, depth + 1, index, function (er) {
        // console.error("Back from processing", this.matches)
        if (errState) return
        if (er) return cb(errState = er)
        if (--l === 0) return cb.call(this)
      }.bind(this))
    }, this)
  })

}

Glob.prototype._stat = function (f, cb) {
  if (f.length > this.options.maxLength) {
    var er = new Error("Path name too long")
    er.code = "ENAMETOOLONG"
    er.path = f
    return this._afterStat(f, cb, er)
  }

  if (this.options.statCache.hasOwnProperty(f)) {
    var exists = this.options.statCache[f]
    , isDir = exists && (Array.isArray(exists) || exists === 2)
    if (this.options.sync) return cb.call(this, !!exists, isDir)
    return process.nextTick(cb.bind(this, !!exists, isDir))
  }

  if (this.options.sync) {
    var er, stat
    try {
      stat = fs.statSync(f)
    } catch (e) {
      er = e
    }
    this._afterStat(f, cb, er, stat)
  } else {
    fs.stat(f, this._afterStat.bind(this, f, cb))
  }
}

Glob.prototype._afterStat = function (f, cb, er, stat) {
  if (er || !stat) {
    exists = false
  } else {
    exists = stat.isDirectory() ? 2 : 1
  }
  this.options.statCache[f] = this.options.statCache[f] || exists
  cb.call(this, !!exists, exists === 2)
}

Glob.prototype._readdir = function (f, cb) {
  if (f.length > this.options.maxLength) {
    var er = new Error("Path name too long")
    er.code = "ENAMETOOLONG"
    er.path = f
    return this._afterReaddir(f, cb, er)
  }

  if (this.options.statCache.hasOwnProperty(f)) {
    var c = this.options.statCache[f]
    if (Array.isArray(c)) {
      if (this.options.sync) return cb.call(this, null, c)
      return process.nextTick(cb.bind(this, null, c))
    }

    if (!c || c === 1) {
      // either ENOENT or ENOTDIR
      // console.error("enoent or enotdir?")
      var code = c ? "ENOTDIR" : "ENOENT"
      , er = new Error((c ? "Not a directory" : "Not found") + ": " + f)
      er.path = f
      er.code = code
      // console.error(f, er)
      if (this.options.sync) return cb.call(this, er)
      return process.nextTick(cb.bind(this, er))
    }

    // at this point, c === 2, meaning it's a dir, but we haven't
    // had to read it yet, or c === true, meaning it's *something*
    // but we don't have any idea what.  Need to read it, either way.
  }

  if (this.options.sync) {
    var er, entries
    try {
      entries = fs.readdirSync(f)
    } catch (e) {
      er = e
    }
    return this._afterReaddir(f, cb, er, entries)
  }

  fs.readdir(f, this._afterReaddir.bind(this, f, cb))
}

Glob.prototype._afterReaddir = function (f, cb, er, entries) {
  if (entries && !er) {
    // console.error("has entries, and no er", f, er, entries)
    this.options.statCache[f] = entries
    // if we haven't asked to stat everything for suresies, then just
    // assume that everything in there exists, so we can avoid
    // having to stat it a second time.  This also gets us one step
    // further into ELOOP territory.
    if (!this.options.mark && !this.options.stat) {
      entries.forEach(function (e) {
        if (f === "/") e = f + e
        else e = f + "/" + e
        this.options.statCache[e] = true
      }, this)
    }

    return cb.call(this, er, entries)
  }

  // now handle errors, and cache the information
  if (er) switch (er.code) {
    case "ENOTDIR": // totally normal. means it *does* exist.
      this.options.statCache[f] = 1
      return cb.call(this, er)
    case "ENOENT": // not terribly unusual
    case "ELOOP":
    case "ENAMETOOLONG":
    case "UNKNOWN":
      this.options.statCache[f] = false
      return cb.call(this, er)
    default: // some unusual error.  Treat as failure.
      this.options.statCache[f] = false
      if (this.options.strict) this.emit("error", er)
      if (!this.options.silent) console.error("glob error", er)
      return cb.call(this, er)
  }
}
