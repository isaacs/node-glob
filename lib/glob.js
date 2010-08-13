// the nice wrapper around the raw C++ binding.

var binding = require("../build/default/glob")

exports.glob = glob
exports.globSync = globSync

Object.keys(binding)
  .filter(function (k) { return k.match(/^GLOB_/) })
  .forEach(function (k) { exports[k] = binding[k], exports[binding[k]] = k })

function glob (pattern, flags, cb) {
  console.log("glob", pattern, flags, cb)
  if (typeof cb !== "function") cb = flags, flags = 0
  if (typeof cb !== "function") throw new Error(
    "usage: glob(pattern, [flags,] cb)")

  if (!flags) flags = 0

  console.log("glob", pattern, flags, cb)
  return binding.glob(pattern, flags, function (er, matches) {
    console.log("back from binding", er, matches)
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


