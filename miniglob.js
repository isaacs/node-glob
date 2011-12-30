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

  var g = new Miniglob(pattern, options)
  g.on("error", cb)
  g.findAll(function (matches) { cb(null, matches) })
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

  this.queue = new FastList()
  this.matches = new FastList()
  EE.call(this)
}

Miniglob.prototype.findAll = findAll
function findAll (cb) {
  var me = this
    , cwd = me.cwd
    // almost always want lstat
    , stat = me.options.follow ? "stat" : "lstat"

  if (me.options.debug) {
    console.error("findAll", cwd, "\n", me.matches.slice())
  }

  fs.readdir(cwd, function (er, files) {
    if (me.options.debug) {
      console.error("readdir", cwd, files)
    }
    files = files.filter(function (f) {
      return f !== ".." && (me.options.dot || f.charAt(0) !== ".")
    }).map(function (f) {
      return path.resolve(cwd, f)
    })

    var count = files.length
    if (count === 0) next()

    files.forEach(function (f) {
      fs[stat](f, function (er, st) {
        if (er) {
          er.miniglob = me
          er.miniglob_pattern = me.pattern
          er.miniglob_options = me.options
          er.miniglob_cwd = cwd
          return me.emit("error", er)
        }
        count --
        if (me.options.debug) {
          console.error(f, st.isDirectory())
        }

        // if this thing is a match, then add to the matches list.
        var matches = me.minimatch.match(f)
        if (matches) {
          me.matches.push(f)
        }
        if (st.isDirectory()) {
          // if it's a dir, it can also match partially, and still be
          // worth exploring.
          matches = matches || me.minimatch.match(f, true)
          if (me.options.debug) {
            console.error("  partial", f, matches)
          }
          if (matches) me.queue.push(f)
        }

        // if we have no more files to process in this pass, and
        // we haven't added anything to the queue, then we're done.
        if (me.options.debug) {
          console.error("findAll done", count, f, me.queue.slice())
        }

        if (count === 0) next()
      })

    })

    function next () {
      if (me.options.debug) {
        console.error("  count is 0")
      }
      if (me.queue.length === 0) {
        var matches = me.matches.slice().map(function (m) {
          return path.relative(me.options.cwd, m)
        })
        if (!me.options.nosort) {
          matches = matches.sort(function (a, b) {
            return a > b ? 1 : a < b ? -1 : 0
          })
        }
        cb(matches)
      } else {
        me.cwd = me.queue.shift()
        me.findAll(cb)
      }
    }

  })
}
