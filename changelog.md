## 9.0

This is a full rewrite.

- Promise API instead of callbacks.
- Accept pattern as string or array of strings.
- Hybrid module distribution.
- Full TypeScript support.
- Removed `root` option and mounting behavior.
- Removed `stat` option. It's slow and pointless. (Could bring
  back easily if there's demand.)
- Simplified `cwd` behavior. Now it just serves as the initial
  argument to `fs.readdir`.
- Removed all stat calls, in favor of using `withFileTypes:true`
  with `fs.readdir()`.
- Consolidated all caching to a single object that only caches
  directory entries and `readdir` errors. We can actually get
  everything we need from just that.
- Removed EventEmitter behavior from exported `Glob` class.
- Consolidated sync and async `Glob` class behavior into a single
  class with `process()` and `processSync()` methods.
- Removed `silent` and `strict` options. Any readdir errors are
  simply treated as "the directory could not be read", and it is
  treated as a normal file entry instead, like shells do.
- Removed `fs` option. This module only operates on the real
  filesystem. (Could bring back if there's demand for it.)
- Only support node 16 and higher.

## 8.1

- Add `windowsPathsNoEscape` option

## 8.0

- Only support node v12 and higher
- `\` is now **only** used as an escape character, and never as a
  path separator in glob patterns, so that Windows users have a
  way to match against filenames containing literal glob pattern
  characters.
- Glob pattern paths **must** use forward-slashes as path
  separators, since `\` is an escape character to match literal
  glob pattern characters.
- (8.0.2) `cwd` and `root` will always be automatically coerced
  to use `/` as path separators on Windows, as they cannot
  contain glob patterns anyway, and are often supplied by
  `path.resolve()` and other methods that will use `\` path
  separators by default.

## 7.2

- Add fs option to allow passing virtual filesystem

## 7.1

- Ignore stat errors that are not `ENOENT` to work around Windows issues.
- Support using root and absolute options together
- Bring back lumpy space princess
- force 'en' locale in string sorting

## 7.0

- Raise error if `options.cwd` is specified, and not a directory

## 6.0

- Remove comment and negation pattern support
- Ignore patterns are always in `dot:true` mode

## 5.0

- Deprecate comment and negation patterns
- Fix regression in `mark` and `nodir` options from making all cache
  keys absolute path.
- Abort if `fs.readdir` returns an error that's unexpected
- Don't emit `match` events for ignored items
- Treat ENOTSUP like ENOTDIR in readdir

## 4.5

- Add `options.follow` to always follow directory symlinks in globstar
- Add `options.realpath` to call `fs.realpath` on all results
- Always cache based on absolute path

## 4.4

- Add `options.ignore`
- Fix handling of broken symlinks

## 4.3

- Bump minimatch to 2.x
- Pass all tests on Windows

## 4.2

- Add `glob.hasMagic` function
- Add `options.nodir` flag

## 4.1

- Refactor sync and async implementations for performance
- Throw if callback provided to sync glob function
- Treat symbolic links in globstar results the same as Bash 4.3

## 4.0

- Use `^` for dependency versions (bumped major because this breaks
  older npm versions)
- Ensure callbacks are only ever called once
- switch to ISC license

## 3.x

- Rewrite in JavaScript
- Add support for setting root, cwd, and windows support
- Cache many fs calls
- Add globstar support
- emit match events

## 2.x

- Use `glob.h` and `fnmatch.h` from NetBSD

## 1.x

- `glob.h` static binding.
