# Glob

Match files using the patterns the shell uses.

This is a glob implementation in JavaScript. It uses the
[`minimatch`](http://npm.im/minimatch) library to do its
matching.

![a fun cartoon logo made of glob characters](logo/glob.png)

## Usage

Install with npm

```
npm i glob
```

```js
// load using import
import { glob } from 'glob'
// or using commonjs
const { glob } = require('glob')

// these all return arrays of filenames

// all js files, but don't look in node_modules
const jsfiles = await glob('**/*.js', { ignore: 'node_modules/**' })

// multiple patterns supported as well
const images = await glob(['css/*.{png,jpeg}', 'public/*.{png,jpeg}'])

// but of course you can do that with the glob pattern also
const imagesAlt = await glob('{css,public}/*.{png,jpeg}')
```

## `glob(pattern: string | string[], options?: GlobOptions) => Promise<string[]>`

Perform an asynchronous glob search for the pattern(s) specified.
See below for options field desciptions.

## `globSync(pattern: string, options?: GlobOptions) => string[]`

Synchronous form of `glob()`.

## Options

Exported as `GlobOptions` TypeScript interface.

All options that can be passed to
[`minimatch`](http://npm.im/minimatch) can also be passed to Glob
to affect pattern matching behavior.

All options are optional, and false by default, unless otherwise
noted.

All options are added to the Glob object, as well.

If you are running many `glob` operations, you can pass a Glob
object as the `options` argument to a subsequent operation to
shortcut some `readdir` calls. At the very least, you may pass in
a shared `cache` option, so that parallel glob operations will be
sped up by sharing information about the filesystem.

- `cwd` The current working directory in which to search.
  Defaults to `process.cwd()`. This option is always coerced to
  use forward-slashes as a path separator, because it is not
  tested as a glob pattern, so there is no need to escape
  anything.
- `windowsPathsNoEscape` Use `\\` as a path separator _only_, and
  _never_ as an escape character. If set, all `\\` characters are
  replaced with `/` in the pattern. Note that this makes it
  **impossible** to match against paths containing literal glob
  pattern characters, but allows matching with patterns
  constructed using `path.join()` and `path.resolve()` on Windows
  platforms, mimicking the (buggy!) behavior of Glob v7 and
  before on Windows. Please use with caution, and be mindful of
  [the caveat below about Windows paths](#windows). (For legacy
  reasons, this is also set if `allowWindowsEscape` is set to the
  exact value `false`.)
- `dot` Include `.dot` files in normal matches and `globstar`
  matches. Note that an explicit dot in a portion of the pattern
  will always match dot files.
- `mark` Add a `/` character to directory matches. Note that this
  requires additional stat calls.
- `nosort` Don't sort the results.
- `cache` See `cache` property above. Pass in a previously
  generated cache object to save some fs calls.
- `nounique` In some cases, brace-expanded patterns or symlinks
  resolved with `{realpath: true}` can result in the same path
  showing up multiple times in the result set. By default, this
  implementation prevents duplicates in the result set. Set this
  flag to disable that behavior.
- `nobrace` Do not expand `{a,b}` and `{1..3}` brace sets.
- `noglobstar` Do not match `**` against multiple filenames. (Ie,
  treat it as a normal `*` instead.)
- `noext` Do not match `+(a|b)` "extglob" patterns.
- `nocase` Perform a case-insensitive match. Note: on
  case-insensitive filesystems, non-magic patterns may match
  case-insensitively by default, since `stat` and `readdir` will
  not raise errors.
- `matchBase` Perform a basename-only match if the pattern does
  not contain any slash characters. That is, `*.js` would be
  treated as equivalent to `**/*.js`, matching all js files in
  all directories.
- `nodir` Do not match directories, only files. (Note: to match
  _only_ directories, simply put a `/` at the end of the
  pattern.)
- `ignore` A glob pattern or array of glob patterns to exclude
  from matches. To ignore all children within a directory, as
  well as the entry itself, append `/**'` to the ignore pattern.
  Note: `ignore` patterns are _always_ in `dot:true` mode,
  regardless of any other settings.
- `follow` Follow symlinked directories when expanding `**`
  patterns. Note that this can result in a lot of duplicate
  references in the presence of cyclic links, and make
  performance quite bad.
- `realpath` Set to true to call `fs.realpath` on all of the
  results. In the case of an entry that cannot be resolved, the
  path-resolved absolute path to the matched entry is returned
  (though it will usually be a broken symlink).
- `absolute` Set to true to always receive absolute paths for
  matched files. Note that this does _not_ make an extra system
  call to get the realpath, it only does string path resolution.
- `nonull` When a brace-expanded portion of the pattern does not
  have find matches, setting `{nonull:true}` will cause glob to
  return the pattern itself instead of the empty set.

`nocomment` and `nonegate` are always set to `false`.

## `hasMagic(pattern: string, options?: GlobOptions) => boolean`

Returns `true` if there are any special characters in the
pattern, and `false` otherwise.

Note that the options affect the results. If `noext:true` is set
in the options object, then `+(a|b)` will not be considered a
magic pattern. If the pattern has a brace expansion, like
`a/{b/c,x/y}` then that is considered magical, unless
`{nobrace:true}` is set in the options.

## Class: `Glob`

The implementation called by the `glob()` method.

```js
import { Glob } from 'glob'
const ohMyGlob = new Glob(pattern, options)

// sync traversal
const results = ohMyGlob.processSync()

// async traversal
const results = await ohMyGlob.process()
```

### `new Glob(pattern: string, options?: GlobOptions | Glob)`

Constructs a new `Glob` object.

### `glob.process() => Promise<string[]>`

Performs a directory walk and returns the matching entries.

### `glob.processSync() => string[]`

Synchronous form of `glob.process()`

## Glob Primer

Much more information about glob pattern expansion can be found
by running `man bash` and searching for `Pattern Matching`.

"Globs" are the patterns you type when you do stuff like `ls
*.js` on the command line, or put `build/*` in a `.gitignore`
file.

Before parsing the path part patterns, braced sections are
expanded into a set. Braced sections start with `{` and end with
`}`, with 2 or more comma-delimited sections within. Braced
sections may contain slash characters, so `a{/b/c,bcd}` would
expand into `a/b/c` and `abcd`.

The following characters have special magic meaning when used in
a path portion:

- `*` Matches 0 or more characters in a single path portion
- `?` Matches 1 character
- `[...]` Matches a range of characters, similar to a RegExp
  range. If the first character of the range is `!` or `^` then
  it matches any character not in the range.
- `!(pattern|pattern|pattern)` Matches anything that does not
  match any of the patterns provided. May _not_ contain `/`
  characters.
- `?(pattern|pattern|pattern)` Matches zero or one occurrence of
  the patterns provided. May _not_ contain `/` characters.
- `+(pattern|pattern|pattern)` Matches one or more occurrences of
  the patterns provided. May _not_ contain `/` characters.
- `*(a|b|c)` Matches zero or more occurrences of the patterns
  provided. May _not_ contain `/` characters.
- `@(pattern|pat*|pat?erN)` Matches exactly one of the patterns
  provided. May _not_ contain `/` characters.
- `**` If a "globstar" is alone in a path portion, then it
  matches zero or more directories and subdirectories searching
  for matches. It does not crawl symlinked directories, unless
  `{follow:true}` is passed in the options object.

Note that `[:class:]`, `[=c=]`, and `[.symbol.]` style class
patterns are _not_ supported by this implementation.

### Dots

If a file or directory path portion has a `.` as the first
character, then it will not match any glob pattern unless that
pattern's corresponding path part also has a `.` as its first
character.

For example, the pattern `a/.*/c` would match the file at
`a/.b/c`. However the pattern `a/*/c` would not, because `*` does
not start with a dot character.

You can make glob treat dots as normal characters by setting
`dot:true` in the options.

### Basename Matching

If you set `matchBase:true` in the options, and the pattern has
no slashes in it, then it will seek for any file anywhere in the
tree with a matching basename. For example, `*.js` would match
`test/simple/basic.js`.

### Empty Sets

If no matching files are found, then an empty array is returned.
This differs from the shell, where the pattern itself is
returned. For example:

```sh
$ echo a*s*d*f
a*s*d*f
```

To return the pattern when there are no matches, use the
`{nonull:true}` option.

## Comparisons to other fnmatch/glob implementations

While strict compliance with the existing standards is a
worthwhile goal, some discrepancies exist between node-glob and
other implementations, and are intentional.

The double-star character `**` is supported by default, unless
the `noglobstar` flag is set. This is supported in the manner of
bsdglob and bash 5, where `**` only has special significance if
it is the only thing in a path part. That is, `a/**/b` will match
`a/x/y/b`, but `a/**b` will not.

Note that symlinked directories are not traversed as part of a
`**`, though their contents may match against subsequent portions
of the pattern. This prevents infinite loops and duplicates and
the like. You can force glob to traverse symlinks with `**` by
setting `{follow:true}` in the options.

If an escaped pattern has no matches, and the `nonull` flag is
set, then glob returns the pattern as-provided, rather than
interpreting the character escapes. For example, `glob.match([],
"\\*a\\?")` will return `"\\*a\\?"` rather than `"*a?"`. This is
akin to setting the `nullglob` option in bash, except that it
does not resolve escaped pattern characters.

If brace expansion is not disabled, then it is performed before
any other interpretation of the glob pattern. Thus, a pattern
like `+(a|{b),c)}`, which would not be valid in bash or zsh, is
expanded **first** into the set of `+(a|b)` and `+(a|c)`, and
those patterns are checked for validity. Since those two are
valid, matching proceeds.

The character class patterns `[:class:]` (POSIX standard named
classes), `[=c=]` (locale-specific character collation weight),
and `[.symbol.]` (collating symbol) style class patterns are
_not_ supported by this implementation.

### Comments and Negation

Previously, this module let you mark a pattern as a "comment" if
it started with a `#` character, or a "negated" pattern if it
started with a `!` character.

These options were deprecated in version 5, and removed in
version 6.

To specify things that should not match, use the `ignore` option.

## Windows

**Please only use forward-slashes in glob expressions.**

Though windows uses either `/` or `\` as its path separator, only
`/` characters are used by this glob implementation. You must use
forward-slashes **only** in glob expressions. Back-slashes will
always be interpreted as escape characters, not path separators.

Results from absolute patterns such as `/foo/*` are mounted onto
the root setting using `path.join`. On windows, this will by
default result in `/foo/*` matching `C:\foo\bar.txt`.

To automatically coerce all `\` characters to `/` in pattern
strings, **thus making it impossible to escape literal glob
characters**, you may set the `windowsPathsNoEscape` option to
`true`.

## Race Conditions

Glob searching, by its very nature, is susceptible to race
conditions, since it relies on directory walking.

As a result, it is possible that a file that exists when glob
looks for it may have been deleted or modified by the time it
returns the result.

By design, this implementation caches all readdir calls that it
makes, in order to cut down on system overhead. However, this
also makes it even more susceptible to races, especially if the
cache object is reused between glob calls.

Users are thus advised not to use a glob result as a guarantee of
filesystem state in the face of rapid changes. For the vast
majority of operations, this is never a problem.

### See Also:

- `man sh`
- `man bash` (Search for "Pattern Matching")
- `man 3 fnmatch`
- `man 5 gitignore`
- [minimatch documentation](https://github.com/isaacs/minimatch)

## Glob Logo

Glob's logo was created by [Tanya
Brassie](http://tanyabrassie.com/). Logo files can be found
[here](https://github.com/isaacs/node-glob/tree/master/logo).

The logo is licensed under a [Creative Commons
Attribution-ShareAlike 4.0 International
License](https://creativecommons.org/licenses/by-sa/4.0/).

## Contributing

Any change to behavior (including bugfixes) must come with a
test.

Patches that fail tests or reduce performance will be rejected.

```sh
# to run tests
npm test

# to re-generate test fixtures
npm run test-regen

# to benchmark against bash/zsh
npm run bench

# to profile javascript
npm run prof
```
![](oh-my-glob.gif)
