// the nice wrapper around the raw C++ binding.

var binding = require(process.env.GLOB_DEBUG != undefined
                     ? "../build/default/glob_g"
                     : "../build/default/glob")

exports.glob = glob
exports.globSync = globSync
exports.fnmatch = fnmatch

Object.keys(binding)
  .filter(function (k) { return k.match(/^GLOB_/) })
  .forEach(function (k) {
    glob[k] = globSync[k] = exports[k] = binding[k]
    globSync[binding[k]] = glob[binding[k]] = k
  })

Object.keys(binding)
  .filter(function (k) { return k.match(/^FNM_/) })
  .forEach(function (k) {
    fnmatch[k] = exports[k] = binding[k]
    fnmatch[binding[k]] = k
  })

// sane defaults.
exports.FNM_DEFAULT = binding.FNM_PATHNAME | binding.FNM_PERIOD
fnmatch.FNM_DEFAULT = exports.FNM_DEFAULT
fnmatch[fnmatch.FNM_DEFAULT] = "FNM_DEFAULT"

exports.GLOB_DEFAULT = binding.GLOB_BRACE
                     | binding.GLOB_STAR
                     | binding.GLOB_MARK
                     | binding.GLOB_TILDE
glob.GLOB_DEFAULT = globSync.GLOB_DEFAULT = exports.GLOB_DEFAULT
glob[glob.GLOB_DEFAULT] = globSync[glob.GLOB_DEFAULT] = "GLOB_DEFAULT"

function glob (pattern, flags, cb) {
  // console.log("glob", pattern, flags, cb)
  if (typeof cb !== "function") cb = flags, flags = null
  if (typeof cb !== "function") throw new Error(
    "usage: glob(pattern, [flags,] cb)")

  if (!flags) flags = exports.GLOB_DEFAULT

  // console.log("glob", pattern, flags, cb)
  return binding.glob(pattern, flags, function (er, matches) {
    // console.log("back from binding", er, matches)
    // swallow this error, since it's really not such a big deal.
    if (er && er.message === "GLOB_NOMATCH") matches = [], er = null
    if (er && exports.hasOwnProperty(er.message)) {
      er.errno = exports[er.message]
    }
    cb(er, matches)
  })
}

function globSync (pattern, flags) {
  if (!flags) flags = exports.GLOB_DEFAULT
  if (typeof pattern !== "string") throw new Error(
    "usage: globSync(pattern [, flags])")
  try {
    return binding.globSync(pattern, flags)
  } catch (er) {
    if (er.message === "GLOB_NOMATCH") return []
    if (exports.hasOwnProperty(er.message)) {
      er.errno = exports[er.message]
    }
    throw er
  }
}

function fnmatch (pattern, str, flags) {
  if (typeof flags !== "number") {
    flags = exports.FNM_DEFAULT
  }
  var res = binding.fnmatch(pattern, str, flags)
  if (res === 0) return true
  if (res === binding.FNM_NOMATCH) return false
  throw new Error("fnmatch error "+res)
}
