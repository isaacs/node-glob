module.exports = miniglob

var fs = require("graceful-fs")
, Minimatch = require("minimatch").Minimatch
, inherits = require("inherits")
, EE = require("events").EventEmitter
, FastList = require("fast-list")
, path = require("path")

// Globbing is a *little* bit different than just matching, in some
// key ways.
//
// First, and importantly, it matters a great deal whether a pattern
// is "absolute" or "relative".  Absolute patterns are patterns that
// start with / on unix, or a full device/unc path on windows.
//
// Second, globs interact with the actual filesystem, so being able
// to stop searching as soon as a match is no longer possible is of
// the utmost importance.  It would not do to traverse a large file
// tree, and then eliminate all but one of the options, if it could
// be possible to skip the traversal early.

// Get a Minimatch object from the pattern and options.  Then, starting
// from the options.root or the cwd, read the dir, and do a partial
// match on all the files if it's a dir, or a regular match if it's not.


function miniglob (pattern, options, cb) {
  if (typeof options === "function") cb = options, options = {}
  if (!options) options = {}

  var g = new Miniglob(pattern, options)
  if (typeof cb === "function") {
    g.on("error", cb)
    g.on("end", function (matches) { cb(null, matches) })
  }
  return g
}

miniglob.Miniglob = Miniglob
inherits(Miniglob, EE)
function Miniglob (pattern, options) {
  var options = options || {}

  var cwd = this.cwd = options.cwd =
    options.cwd || process.cwd()

  this.root = options.root =
    options.root || path.resolve(cwd, "/")

  if (!pattern) {
    throw new Error("must provide pattern")
  }

  var mm = this.minimatch = new Minimatch(pattern, options)
  options = this.options = mm.options
  pattern = this.pattern = mm.pattern

  this.error = null

  this.matches = new FastList()
  EE.call(this)
  var me = this
  this._process(this.cwd, 1, function () {
    if (me.options.debug) {
      console.error("!!! GLOB top level cb", me)
    }
    if (options.nonull && me.matches.length === 0) {
      var found = [pattern]
    } else {
      var found = me.matches.slice()
    }

    found = found.map(function (m) {
      if (m.indexOf(me.options.cwd) === 0) {
        m = m.substr(me.options.cwd.length + 1)
      }
      return m
    })

    if (!me.options.nosort) {
      found = found.sort(function (a, b) {
        return a > b ? 1 : a < b ? -1 : 0
      })
    }

    me.emit("end", found)
  })
}


Miniglob.prototype._process = _process
function _process (f, depth, cb) {
  var pref = depth + new Array(depth + 1).join(" ") + "GLOB "
  var me = this

  // if f matches, then it's a match.  emit it, move on.
  // if it *partially* matches, then it might be a dir.
  //
  // possible optimization: don't just minimatch everything
  // against the full pattern.  if a bit of the pattern is
  // not magical, it'd be good to reduce the number of stats
  // that had to be made.  so, in the pattern: "a/*/b", we could
  // readdir a, then stat a/<child>/b in all of them.
  //
  // however, that'll require a lot of muddying between minimatch
  // and miniglob, and at least for the time being, it's kind of nice to
  // keep them a little bit separate.

  // if this thing is a match, then add to the matches list.
  var match = me.minimatch.match(f)
  if (!match) return me._processPartial(f, depth, cb)

  if (match) {
    if (me.options.debug) {
      console.error(pref + " %s matches %s", f, me.pattern)
    }
    // make sure it exists if asked.
    if (me.options.stat) {
      var stat = me.options.follow ? "stat" : "lstat"
      fs[stat](f, function (er, st) {
        if (er) return cb()
        emitMatch()
      })
    } else process.nextTick(emitMatch)

    return

    function emitMatch () {
      if (me.options.debug) {
        console.error(pref, "emitting match", f)
      }
      me.matches.push(f)
      me.emit("match", f)
      // move on, since it might also be a partial match
      // eg, a/**/c matches both a/c and a/c/d/c
      me._processPartial(f, depth, cb)
    }
  }

 }


Miniglob.prototype._processPartial = function _processPartial (f, depth, cb) {

  var me = this
  var pref = depth + new Array(depth + 1).join(" ") + "GLOB "

  var partial = me.minimatch.match(f, true)
  if (!partial) {
    if (me.options.debug) console.error(pref + "not a partial", f)

    // if not a match or partial match, just move on.
    return cb()
  }

  // partial match
  // however, this only matters if it's a dir.
  //if (me.options.debug)
  if (me.options.debug) {
    console.error(pref, "got a partial", f)
  }
  me.emit("partial", f)

  me._processDir(f, depth, cb)
}

Miniglob.prototype._processDir = function _processDir (f, depth, cb) {

  var me = this
  var pref = depth + new Array(depth + 1).join(" ") + "GLOB "

  // now the fun stuff.
  // if it's a dir, then we'll read all the children, and process them.
  // if it's not a dir, or we can't access it, then it'll fail.
  // We log a warning for EACCES and EPERM, but ENOTDIR and ENOENT are
  // expected and fine.

  fs.readdir(f, function (er, children) {
    if (er) switch (er.code) {
      case "ENOENT":
      case "ENOTDIR":
        return cb()
      default:
        if (!me.options.silent) console.error("miniglob error", er)
        if (me.options.strict) return cb(er)
        return cb()
    }

    if (-1 === children.indexOf(".")) children.push(".")
    if (-1 === children.indexOf("..")) children.push("..")

    var count = children.length
    if (me.options.debug) {
      console.error(pref + "count=%d %s", count, f, children)
    }

    if (count === 0) {
      //if (me.options.debug)
      if (me.options.debug) {
        console.error("no children?", children, f)
      }
      return then(f)()
    }

    children.forEach(function (c) {
      //if (c === "." || c === "..") {
      //  count --
      //  return
      //}
      if (me.options.debug) {
        console.error(pref + " processing", f + "/" + c)
      }
      me._process(f + "/" + c, depth + 1, then(f + "/" + c))
    })


    function then (f) { return function (er) {
      count --
      if (me.options.debug) {
        console.error("%s THEN %s", pref, f, count, count <= 0 ? "done" : "not done")
      }
      if (me.error) return
      if (er) return me.emit("error", me.error = er)
      if (count <= 0) {
        cb()
      }
    }}
  })
}

