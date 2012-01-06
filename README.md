# miniglob

miniglob : glob :: minimatch : fnmatch

This is a glob implementation in JavaScript.  Very soon, it will replace
the C++ binding in node-glob.  It may be folded into minimatch, as well,
but for now, keeping the two libs separate is convenient.

This is still very alpha.  Come back later for better tests and docs,
once it solidifies a bit more.

## Usage

```javascript
var miniglob = require("miniglob")

// options is optional
miniglob("**/*.js", options, function (er, files) {
  // files is an array of filenames.
  // If the `nonull` option is set, and nothing
  // was found, then files is ["**/*.js"]
  // er is an error object or null.
})
```

## Features

Please see the [minimatch
documentation](https://github.com/isaacs/minimatch) for more details.

Supports these glob features:

* Brace Expansion
* Extended glob matching
* "Globstar" `**` matching

See:

* `man sh`
* `man bash`
* `man 3 fnmatch`
* `man 5 gitignore`
* [minimatch documentation](https://github.com/isaacs/minimatch)

## Miniglob Class

Create a miniglob object by instanting the `miniglob.Miniglob` class.

```javascript
var Miniglob = require("miniglob").Miniglob
var mg = new Miniglob(pattern, options)
```

It's an EventEmitter.

### Properties

* `minimatch` The minimatch object that the miniglob uses.
* `options` The options object passed in.
* `matches` A [FastList](https://github.com/isaacs/fast-list) object
  containing the matches as they are found.
* `error` The error encountered.  When an error is encountered, the
  miniglob object is in an undefined state, and should be discarded.
* `aborted` Boolean which is set to true when calling `abort()`.  There
  is no way at this time to continue a glob search after aborting.

### Events

* `end` When the matching is finished, this is emitted with all the
  matches found.  If the `nonull` option is set, and no match was found,
  then the `matches` list contains the original pattern.  The matches
  are sorted, unless the `nosort` flag is set.
* `match` Every time a match is found, this is emitted with the pattern.
* `partial` Emitted when a directory matches the start of a pattern, and
  is then searched for additional matches.
* `error` Emitted when an unexpected error is encountered.
* `abort` When `abort()` is called, this event is raised.

### Methods

* `abort` Stop the search.

### Options

All the options that can be passed to Minimatch can also be passed to
Miniglob to change pattern matching behavior.  Additionally, these ones
are added which are glob-specific, or have glob-specific ramifcations.

All options are false by default.

* `cwd` The current working directory in which to search.  Since, unlike
  Minimatch, Miniglob requires a working directory to start in, this
  defaults to `process.cwd()`.
* `root` Since Miniglob requires a root setting, this defaults to
  `path.resolve(options.cwd, "/")`.
* `mark` Add a `/` character to directory matches.
* `follow` Use `stat` instead of `lstat`.  This can cause undesirable
  behavior in the case of symbolic link cycles.
* `nosort` Don't sort the results.
* `stat` Set to true to stat/lstat *all* results.  This reduces performance
  somewhat, but guarantees that the results are files that actually
  exist.
* `silent` When an error other than `ENOENT` or `ENOTDIR` is encountered
  when attempting to read a directory, a warning will be printed to
  stderr.  Set the `silent` option to true to suppress these warnings.
* `strict` When an error other than `ENOENT` or `ENOTDIR` is encountered
  when attempting to read a directory, the process will just continue on
  in search of other matches.  Set the `strict` option to raise an error
  in these cases.
