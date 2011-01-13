// the nice wrapper around the raw C++ binding.

var binding = require("../build/default/glob")

exports.glob = glob
exports.globSync = globSync
exports.fnmatch = fnmatch

Object.keys(binding)
  .filter(function (k) { return k.match(/^GLOB_/) })
  .forEach(function (k) { exports[k] = binding[k], exports[binding[k]] = k })

Object.keys(binding)
  .filter(function (k) { return k.match(/^FNM_/) })
  .forEach(function (k) { exports[k] = binding[k] })

// most shells set these, so use them as the defaults.
exports.FNM_DEFAULT = binding.FNM_PATHNAME | binding.FNM_PERIOD

function glob (pattern, flags, cb) {
  // console.log("glob", pattern, flags, cb)
  if (typeof cb !== "function") cb = flags, flags = 0
  if (typeof cb !== "function") throw new Error(
    "usage: glob(pattern, [flags,] cb)")

  if (!flags) flags = 0

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
  if (!flags) flags = 0
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
