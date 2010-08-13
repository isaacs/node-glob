// the nice wrapper around the raw C++ binding.

var binding = require("../build/default/glob")

exports.glob = glob
exports.globSync = globSync
var glob_t = exports.glob_t = binding.glob_t

Object.keys(binding)
  .filter(function (k) { return k.match(/^GLOB_/) })
  .forEach(function (k, v) { exports[k] = v, exports[v] = k })

function glob (pattern, flags, gt, cb) {
  if (typeof cb !== "function") cb = gt, gt = null
  if (typeof cb !== "function") cb = flags, flags = 0
  if (typeof cb !== "function") throw new Error(
    "usage: glob(pattern, [flags, gt,] cb)")
  
  if (!flags) flags = 0
  if (!gt) gt = new glob_t
  
  return binding.glob(pattern, flags, gt, function (er, matches) {
    // swallow this error, since it's really not such a big deal.
    if (er && er.message === "GLOB_NOMATCH") matches = [], er = null
    if (er && exports.hasOwnProperty(er.message)) {
      er.errno = exports[er.message]
    }
    cb(er, matches)
  })
}

function globSync (pattern, flags, gt) {
  if (!gt) gt = new glob_t
  if (!flags) flags = 0
  if (typeof pattern !== "string") throw new Error(
    "usage: globSync(pattern [, flags, gt])")
  try {
    return binding.globSync(pattern, flags, gt)
  } catch (er) {
    if (exports.hasOwnProperty(er.message)) {
      er.errno = exports[er.message]
    }
    throw er
  }
}


