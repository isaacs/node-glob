# Glob

This is a glob implementation in JavaScript.  It uses the `minimatch`
library to do its matching.

## Attention: node-glob users!

The API has changed dramatically between 2.x and 3.x. This library is
now 100% JavaScript, and the integer flags have been replaced with an
options object.

Also, there's an event emitter class, proper tests, and all the other
things you've come to expect from node modules.

And best of all, no compilation!

## Usage

```javascript
var glob = require("glob")

// options is optional
glob("**/*.js", options, function (er, files) {
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

## Glob Class

Create a glob object by instanting the `glob.Glob` class.

```javascript
var Glob = require("glob").Glob
var mg = new Glob(pattern, options)
```

It's an EventEmitter.

### Properties

* `minimatch` The minimatch object that the glob uses.
* `options` The options object passed in.
* `error` The error encountered.  When an error is encountered, the
  glob object is in an undefined state, and should be discarded.
* `aborted` Boolean which is set to true when calling `abort()`.  There
  is no way at this time to continue a glob search after aborting.

### Events

* `end` When the matching is finished, this is emitted with all the
  matches found.  If the `nonull` option is set, and no match was found,
  then the `matches` list contains the original pattern.  The matches
  are sorted, unless the `nosort` flag is set.
* `match` Every time a match is found, this is emitted with the matched.
* `error` Emitted when an unexpected error is encountered, or whenever
  any fs error occurs if `options.strict` is set.
* `abort` When `abort()` is called, this event is raised.

### Methods

* `abort` Stop the search.

### Options

All the options that can be passed to Minimatch can also be passed to
Glob to change pattern matching behavior.  Additionally, these ones
are added which are glob-specific, or have glob-specific ramifcations.

All options are false by default, unless otherwise noted.

* `cwd` The current working directory in which to search.  Defaults
  to `process.cwd()`.
* `root` The place where patterns starting with `/` will be mounted
  onto.  Defaults to `path.resolve(options.cwd, "/")` (`/` on Unix
  systems, and `C:\` or some such on Windows.)
* `mark` Add a `/` character to directory matches.  Note that this
  requires additional stat calls.
* `nosort` Don't sort the results.
* `stat` Set to true to stat *all* results.  This reduces performance
  somewhat.
* `silent` When an unusual error is encountered
  when attempting to read a directory, a warning will be printed to
  stderr.  Set the `silent` option to true to suppress these warnings.
* `strict` When an unusual error is encountered
  when attempting to read a directory, the process will just continue on
  in search of other matches.  Set the `strict` option to raise an error
  in these cases.
* `statCache` A cache of results of filesystem information, to prevent
  unnecessary stat calls.  While it should not normally be necessary to
  set this, you may pass the statCache from one glob() call to the
  options object of another, if you know that the filesystem will not
  change between calls.
