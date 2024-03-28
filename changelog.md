# changeglob

## 10.3

- Add `--default -p` flag to provide a default pattern
- exclude symbolic links to directories when `follow` and `nodir`
  are both set

## 10.2

- Add glob cli

## 10.1

- Return `'.'` instead of the empty string `''` when the current
  working directory is returned as a match.
- Add `posix: true` option to return `/` delimited paths, even on
  Windows.

## 10.0.0

- No default exports, only named exports

## 9.3.3

- Upgraded minimatch to v8, adding support for any degree of
  nested extglob patterns.

## 9.3

- Add aliases for methods. `glob.sync`, `glob.stream`,
  `glob.stream.sync`, etc.

## 9.2

- Support using a custom fs object, which is passed to PathScurry
- add maxDepth option
- add stat option
- add custom Ignore support

## 9.1

- Bring back the `root` option, albeit with slightly different
  semantics than in v8 and before.
- Support `{ absolute:false }` option to explicitly always return
  relative paths. An unset `absolute` setting will still return
  absolute or relative paths based on whether the pattern is
  absolute.
- Add `magicalBraces` option to treat brace expansion as "magic"
  in the `hasMagic` function.
- Add `dotRelative` option
- Add `escape()` and `unescape()` methods

## 9.0

This is a full rewrite, with significant API and algorithm
changes.

### High-Level Feature and API Surface Changes

- Only support node 16 and higher.
- Promise API instead of callbacks.
- Exported function names have changed, as have the methods on
  the Glob class. See API documentation for details.
- Accept pattern as string or array of strings.
- Hybrid module distribution.
- Full TypeScript support.
- Exported `Glob` class is no longer an event emitter.
- Exported `Glob` class has `walk()`, `walkSync()`, `stream()`,
  `streamSync()`, `iterate()`, `iterateSync()` methods, and is
  both an async and sync Generator.
- First class support for UNC paths and drive letters on Windows.
  Note that _glob patterns_ must still use `/` as a path
  separator, unless the `windowsPathsNoEscape` option is set, in
  which case glob patterns cannot be escaped with `\`.
- Paths are returned in the canonical formatting for the platform
  in question.
- The `hasMagic` method will return false for patterns that only
  contain brace expansion, but no other "magic" glob characters.
- Patterns ending in `/` will still be restricted to matching
  directories, but will not have a `/` appended in the results.
  In general, results will be in their default relative or
  absolute forms, without any extraneous `/` and `.` characters,
  unlike shell matches. (The `mark` option may still be used to
  _always_ mark directory matches with a trailing `/` or `\`.)
- An options argument is required for the `Glob` class
  constructor. `{}` may be provided to accept all default
  options.

### Options Changes

- Removed `root` option and mounting behavior.
- Removed `stat` option. It's slow and pointless. (Could bring
  back easily if there's demand, but items are already statted in
  cases where it's relevant, such as `nodir:true` or
  `mark:true`.)
- Simplified `cwd` behavior so it is far less magical, and relies
  less on platform-specific absolute path representations.
- `cwd` can be a File URL or a string path.
- More efficient handling for absolute patterns. (That is,
  patterns that start with `/` on any platform, or start with a
  drive letter or UNC path on Windows.)
- Removed `silent` and `strict` options. Any readdir errors are
  simply treated as "the directory could not be read", and it is
  treated as a normal file entry instead, like shells do.
- Removed `fs` option. This module only operates on the real
  filesystem. (Could bring back if there's demand for it, but
  it'd be an update to PathScurry, not Glob.)
- `nonull:true` is no longer supported.
- `withFileTypes:true` option added, to get `Path` objects.
  These are a bit like a Dirent, but can do a lot more. See
  <http://npm.im/path-scurry>
- `nounique:true` is no longer supported. Result sets are always
  unique.
- `nosort:true` is no longer supported. Result sets are never
  sorted.
- When the `nocase` option is used, the assumption is that it
  reflects the case sensitivity of the _filesystem itself_.
  Using case-insensitive matching on a case-sensitive filesystem,
  or vice versa, may thus result in more or fewer matches than
  expected. In general, it should only be used when the
  filesystem is known to differ from the platform default.
- `realpath:true` no longer implies `absolute:true`. The
  relative path to the realpath will be emitted when `absolute`
  is not set.
- `realpath:true` will cause invalid symbolic links to be
  omitted, rather than matching the link itself.

### Performance and Algorithm Changes

- Massive performance improvements.
- Removed nearly all stat calls, in favor of using
  `withFileTypes:true` with `fs.readdir()`.
- Replaced most of the caching with a
  [PathScurry](http://npm.im/path-scurry) based implementation.
- More correct handling of `**` vs `./**`, following Bash
  semantics, where a `**` is followed one time only if it is not
  the first item in the pattern.

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
