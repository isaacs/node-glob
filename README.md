# Glob

Match files using the patterns the shell uses.

The safest ([no ReDoS](#redos-protection)), most correct, and
second fastest glob implementation in JavaScript. (See
[**Comparison to Other JavaScript Glob
Implementations**](#comparison-to-other-javascript-glob-implementations)
at the bottom of this readme.)

![a fun cartoon logo made of glob
characters](https://github.com/isaacs/node-glob/raw/main/logo/glob.png)

## Usage

Install with npm

```
npm i glob
```

> [!NOTE]
> The npm package name is _not_ `node-glob` that's a
> different thing that was abandoned years ago. Just `glob`.

```js
// load using import
import { glob, globSync, globStream, globStreamSync, Glob } from 'glob'
// or using commonjs, that's fine, too
const {
  glob,
  globSync,
  globStream,
  globStreamSync,
  Glob,
} = require('glob')

// the main glob() and globSync() resolve/return array of filenames

// all js files, but don't look in node_modules
const jsfiles = await glob('**/*.js', { ignore: 'node_modules/**' })

// pass in a signal to cancel the glob walk
const stopAfter100ms = await glob('**/*.css', {
  signal: AbortSignal.timeout(100),
})

// multiple patterns supported as well
const images = await glob(['css/*.{png,jpeg}', 'public/*.{png,jpeg}'])

// but of course you can do that with the glob pattern also
// the sync function is the same, just returns a string[] instead
// of Promise<string[]>
const imagesAlt = globSync('{css,public}/*.{png,jpeg}')

// you can also stream them, this is a Minipass stream
const filesStream = globStream(['**/*.dat', 'logs/**/*.log'])

// construct a Glob object if you wanna do it that way, which
// allows for much faster walks if you have to look in the same
// folder multiple times.
const g = new Glob('**/foo', {})
// glob objects are async iterators, can also do globIterate() or
// g.iterate(), same deal
for await (const file of g) {
  console.log('found a foo file:', file)
}
// pass a glob as the glob options to reuse its settings and caches
const g2 = new Glob('**/bar', g)
// sync iteration works as well
for (const file of g2) {
  console.log('found a bar file:', file)
}

// you can also pass withFileTypes: true to get Path objects
// these are like a fs.Dirent, but with some more added powers
// check out https://isaacs.github.io/path-scurry/classes/PathBase.html
// for more info on their API
const g3 = new Glob('**/baz/**', { withFileTypes: true })
g3.stream().on('data', path => {
  console.log(
    'got a path object',
    path.fullpath(),
    path.isDirectory(),
    path.readdirSync().map(e => e.name),
  )
})

// if you use stat:true and withFileTypes, you can sort results
// by things like modified time, filter by permission mode, etc.
// All Stats fields will be available in that case. Slightly
// slower, though.
// For example:
const results = await glob('**', { stat: true, withFileTypes: true })

const timeSortedFiles = results
  .sort((a, b) => a.mtimeMs - b.mtimeMs)
  .map(path => path.fullpath())

const groupReadableFiles = results
  .filter(path => path.mode & 0o040)
  .map(path => path.fullpath())

// custom ignores can be done like this, for example by saying
// you'll ignore all markdown files, and all folders named 'docs'
const customIgnoreResults = await glob('**', {
  ignore: {
    ignored: p => /\.md$/.test(p.name),
    childrenIgnored: p => p.isNamed('docs'),
  },
})

// another fun use case, only return files with the same name as
// their parent folder, plus either `.ts` or `.js`
const folderNamedModules = await glob('**/*.{ts,js}', {
  ignore: {
    ignored: p => {
      const pp = p.parent
      return !(p.isNamed(pp.name + '.ts') || p.isNamed(pp.name + '.js'))
    },
  },
})

// find all files edited in the last hour, to do this, we ignore
// all of them that are more than an hour old
const newFiles = await glob('**', {
  // need stat so we have mtime
  stat: true,
  // only want the files, not the dirs
  nodir: true,
  ignore: {
    ignored: p => {
      return new Date() - p.mtime > 60 * 60 * 1000
    },
    // could add similar childrenIgnored here as well, but
    // directory mtime is inconsistent across platforms, so
    // probably better not to, unless you know the system
    // tracks this reliably.
  },
})
```

> [!NOTE]
> Glob patterns should always use `/` as a path separator,
> even on Windows systems, as `\` is used to escape glob
> characters. If you wish to use `\` as a path separator _instead
> of_ using it as an escape character on Windows platforms, you may
> set `windowsPathsNoEscape:true` in the options. In this mode,
> special glob characters cannot be escaped, making it impossible
> to match a literal `*` `?` and so on in filenames.

## Command Line Interface

The glob CLI has been moved to the `glob-bin` package, and must
be installed separately, as of version 13.

```
npm install glob-bin
```

## `glob(pattern: string | string[], options?: GlobOptions) => Promise<string[] | Path[]>`

Perform an asynchronous glob search for the pattern(s) specified.
Returns
[Path](https://isaacs.github.io/path-scurry/classes/PathBase)
objects if the `withFileTypes` option is set to `true`. See below
for full options field desciptions.

## `globSync(pattern: string | string[], options?: GlobOptions) => string[] | Path[]`

Synchronous form of `glob()`.

Alias: `glob.sync()`

## `globIterate(pattern: string | string[], options?: GlobOptions) => AsyncGenerator<string>`

Return an async iterator for walking glob pattern matches.

Alias: `glob.iterate()`

## `globIterateSync(pattern: string | string[], options?: GlobOptions) => Generator<string>`

Return a sync iterator for walking glob pattern matches.

Alias: `glob.iterate.sync()`, `glob.sync.iterate()`

## `globStream(pattern: string | string[], options?: GlobOptions) => Minipass<string | Path>`

Return a stream that emits all the strings or `Path` objects and
then emits `end` when completed.

Alias: `glob.stream()`

## `globStreamSync(pattern: string | string[], options?: GlobOptions) => Minipass<string | Path>`

Syncronous form of `globStream()`. Will read all the matches as
fast as you consume them, even all in a single tick if you
consume them immediately, but will still respond to backpressure
if they're not consumed immediately.

Alias: `glob.stream.sync()`, `glob.sync.stream()`

## `hasMagic(pattern: string | string[], options?: GlobOptions) => boolean`

Returns `true` if the provided pattern contains any "magic" glob
characters, given the options provided.

Brace expansion is not considered "magic" unless the
`magicalBraces` option is set, as brace expansion just turns one
string into an array of strings. So a pattern like `'x{a,b}y'`
would return `false`, because `'xay'` and `'xby'` both do not
contain any magic glob characters, and it's treated the same as
if you had called it on `['xay', 'xby']`. When
`magicalBraces:true` is in the options, brace expansion _is_
treated as a pattern having magic.

## `escape(pattern: string, options?: GlobOptions) => string`

Escape all magic characters in a glob pattern, so that it will
only ever match literal strings

If the `windowsPathsNoEscape` option is used, then characters are
escaped by wrapping in `[]`, because a magic character wrapped in
a character class can only be satisfied by that exact character.

Slashes (and backslashes in `windowsPathsNoEscape` mode) cannot
be escaped or unescaped.

## `unescape(pattern: string, options?: GlobOptions) => string`

Un-escape a glob string that may contain some escaped characters.

If the `windowsPathsNoEscape` option is used, then square-brace
escapes are removed, but not backslash escapes. For example, it
will turn the string `'[*]'` into `*`, but it will not turn
`'\\*'` into `'*'`, because `\` is a path separator in
`windowsPathsNoEscape` mode.

When `windowsPathsNoEscape` is not set, then both brace escapes
and backslash escapes are removed.

Slashes (and backslashes in `windowsPathsNoEscape` mode) cannot
be escaped or unescaped.

## Class `Glob`

An object that can perform glob pattern traversals.

### `const g = new Glob(pattern: string | string[], options: GlobOptions)`

Options object is required.

See full options descriptions below.

> [!NOTE]
> A previous `Glob` object can be passed as the
> `GlobOptions` to another `Glob` instantiation to re-use settings
> and caches with a new pattern.

Traversal functions can be called multiple times to run the walk
again.

### `g.stream()`

Stream results asynchronously.

### `g.streamSync()`

Stream results synchronously.

### `g.iterate()`

Default async iteration function. Returns an AsyncGenerator that
iterates over the results.

### `g.iterateSync()`

Default sync iteration function. Returns a Generator that
iterates over the results.

### `g.walk()`

Returns a Promise that resolves to the results array.

### `g.walkSync()`

Returns a results array.

### Properties

All options are stored as properties on the `Glob` object.

- `opts` The options provided to the constructor.
- `patterns` An array of parsed immutable `Pattern` objects.

## Options

Exported as `GlobOptions` TypeScript interface. A `GlobOptions`
object may be provided to any of the exported methods, and must
be provided to the `Glob` constructor.

All options are optional, boolean, and false by default, unless
otherwise noted.

All resolved options are added to the Glob object as properties.

If you are running many `glob` operations, you can pass a Glob
object as the `options` argument to a subsequent operation to
share the previously loaded cache.

- `cwd` String path or `file://` string or URL object. The
  current working directory in which to search. Defaults to
  `process.cwd()`. See also: "Windows, CWDs, Drive Letters, and
  UNC Paths", below.

  This option may be either a string path or a `file://` URL
  object or string.

- `root` A string path resolved against the `cwd` option, which
  is used as the starting point for absolute patterns that start
  with `/`, (but not drive letters or UNC paths on Windows).

  To start absolute and non-absolute patterns in the same path,
  you can use `{root:''}`. However, be aware that on Windows
  systems, a pattern like `x:/*` or `//host/share/*` will
  _always_ start in the `x:/` or `//host/share` directory,
  regardless of the `root` setting.

> [!NOTE] This _doesn't_ necessarily limit the walk to the
> `root` directory, and doesn't affect the cwd starting point
> for non-absolute patterns. A pattern containing `..` will
> still be able to traverse out of the root directory, if it
> is not an actual root directory on the filesystem, and any
> non-absolute patterns will be matched in the `cwd`. For
> example, the pattern `/../*` with `{root:'/some/path'}`
> will return all files in `/some`, not all files in
> `/some/path`. The pattern `*` with `{root:'/some/path'}`
> will return all the entries in the cwd, not the entries in
> `/some/path`.

- `windowsPathsNoEscape` Use `\\` as a path separator _only_, and
  _never_ as an escape character. If set, all `\\` characters are
  replaced with `/` in the pattern.

> [!NOTE]
> This makes it **impossible** to match against paths
> containing literal glob pattern characters, but allows matching
> with patterns constructed using `path.join()` and
> `path.resolve()` on Windows platforms, mimicking the (buggy!)
> behavior of Glob v7 and before on Windows. Please use with
> caution, and be mindful of [the caveat below about Windows
> paths](#windows). (For legacy reasons, this is also set if
> `allowWindowsEscape` is set to the exact value `false`.)

- `dot` Include `.dot` files in normal matches and `globstar`
  matches. Note that an explicit dot in a portion of the pattern
  will always match dot files.

- `magicalBraces` Treat brace expansion like `{a,b}` as a "magic"
  pattern. Has no effect if {@link nobrace} is set.

  Only has effect on the {@link hasMagic} function, no effect on
  glob pattern matching itself.

- `dotRelative` Prepend all relative path strings with `./` (or
  `.\` on Windows).

  Without this option, returned relative paths are "bare", so
  instead of returning `'./foo/bar'`, they are returned as
  `'foo/bar'`.

  Relative patterns starting with `'../'` are not prepended with
  `./`, even if this option is set.

- `mark` Add a `/` character to directory matches. Note that this
  requires additional stat calls.

- `nobrace` Do not expand `{a,b}` and `{1..3}` brace sets.

- `noglobstar` Do not match `**` against multiple filenames. (Ie,
  treat it as a normal `*` instead.)

- `noext` Do not match "extglob" patterns such as `+(a|b)`.

- `normalize` Normalize unicode in the pattern, and in the file
  names that it is matched against, with this form: `'NFC'`,
  `'NFD'`, `'NFKC'`, or `'NFKD'`. `true` means `'NFC'`. A char
  such as `é` can be one code point, or `e` followed by a
  combining accent, and some file systems (such as on macOS) can
  give names in either form. This is passed to minimatch, so it
  applies to the portions of the pattern with magic, and to the
  `ignore` patterns. The portions of the pattern without magic
  are looked up with path-scurry, which already compares the
  names of the entries that it knows in their `'NFKD'` form.

- `nocase` Perform a case-insensitive match. This defaults to
  `true` on macOS and Windows systems, and `false` on all others.

> [!NOTE]
> `nocase` should only be explicitly set when it is known that
> the filesystem's case sensitivity differs from the platform
> default. If set `true` on case-sensitive file systems, or
> `false` on case-insensitive file systems, then the walk may
> return more or less results than expected.
>
> As a shortcut, `Glob` will use string portions as-is to
> `readdir()` calls while doing its traversal, in place of making
> a case-insensitive matcher for each of them. If you are setting a `nocase: true` match on a
> file system that is in fact case sensitive, then this will
> result in matches not being found that you might expect,
> because for example the pattern `Foo/*` will fail to read the
> `FOO/` or `foo/` directories.
>
> On the other hand, if you set `nocase: false` on a
> case-_insensitive_ system, then the opposite problem occurs:
> `Foo/*` will match `foo/bar`, but because we only detect the
> existence of the `foo/` folder by successfully performing a
> `readdir`, there's no way to know what the "real" case is, and
> the match will be reported as `Foo/bar`, using the case of the
> string portion of the glob pattern.
>
> The default is usually correct, however it _is_ possible to
> mount file systems with a different case-sensitivity from the
> host system. If you know this is the case, set this flag
> appropriately to the file system you are searching.

- `maxDepth` Specify a number to limit the depth of the directory
  traversal to this many levels below the `cwd`.

- `matchBase` Perform a basename-only match if the pattern does
  not contain any slash characters. That is, `*.js` would be
  treated as equivalent to `**/*.js`, matching all js files in
  all directories.

- `nodir` Do not match directories, only files. (Note: to match
  _only_ directories, put a `/` at the end of the pattern.)

> [!NOTE]
> When `follow` and `nodir` are both set, then symbolic
> links to directories are also omitted.

- `stat` Call `lstat()` on all entries, whether required or not
  to determine whether it's a valid match. When used with
  `withFileTypes`, this means that matches will include data such
  as modified time, permissions, and so on. Note that this will
  incur a performance cost due to the added system calls.

- `ignore` string or string[], or an object with `ignored` and
  `childrenIgnored` methods.

  If a string or string[] is provided, then this is treated as
  a glob pattern or array of glob patterns to exclude from
  matches. To ignore all children within a directory, as well
  as the entry itself, append `'/**'` to the ignore pattern.
  Ignore patterns that start with `/` start at the same place as
  other patterns that start with `/` (see the `root` option).

  If an object is provided that has `ignored(path)` and/or
  `childrenIgnored(path)` methods, then these methods will be
  called to determine whether any Path is a match or if its
  children should be traversed, respectively.

  The `path` argument to the methods will be a
  [`path-scurry`](https://isaacs.github.io/path-scurry/index.html)
  [`Path`](https://isaacs.github.io/path-scurry/classes/PathBase)
  object, which extends
  [`fs.Dirent`](https://nodejs.org/docs/latest/api/fs.html#class-fsdirent)
  with additional useful methods like
  [`.fullpath()`](https://isaacs.github.io/path-scurry/classes/PathBase.html#fullpath),
  [`.relative()`](https://isaacs.github.io/path-scurry/classes/PathBase.html#relative),
  and more.

> [!NOTE]
> `ignore` patterns are _always_ in `dot:true` mode,
> regardless of any other settings.

- `follow` Follow symlinked directories when expanding `**`
  patterns. This can result in a lot of duplicate references in
  the presence of cyclic links, and make performance quite bad.

  By default, a `**` in a pattern will follow 1 symbolic link if
  it is not the first item in the pattern, or none if it is the
  first item in the pattern, following the same behavior as Bash.

> [!NOTE]
> When `follow` and `nodir` are both set, then symbolic
> links to directories are also omitted.

- `realpath` Set to true to call `fs.realpath` on all of the
  results. In the case of an entry that cannot be resolved, the
  entry is omitted. This incurs a slight performance penalty, of
  course, because of the added system calls.

- `absolute` Set to true to always receive absolute paths for
  matched files. Set to `false` to always receive relative paths
  for matched files.

  By default, when this option is not set, absolute paths are
  returned for patterns that are absolute, and otherwise paths
  are returned that are relative to the `cwd` setting.

  This does _not_ make an extra system call to get the realpath,
  it only does string path resolution.

  `absolute` may not be used along with `withFileTypes`.

- `posix` Set to true to use `/` as the path separator in
  returned results. On POSIX systems, this has no effect. On
  Windows systems, this will return `/` delimited path results,
  and absolute paths will be returned in their fully resolved UNC
  path form, e.g. instead of `'C:\\foo\\bar'`, it will return
  `//?/C:/foo/bar`.

- `platform` Defaults to the value of `process.platform` if
  available, or `'linux'` if not. Setting `platform:'win32'` on
  non-Windows systems may cause strange behavior.

- `withFileTypes` Return
  [`path-scurry`](http://npm.im/path-scurry)
  [`Path`](https://isaacs.github.io/path-scurry/classes/PathBase.html)
  objects instead of strings. These are similar to a NodeJS
  `fs.Dirent` object, but with additional methods and properties.

  `withFileTypes` may not be used along with `absolute`.

- `signal` An AbortSignal which will cancel the Glob walk when
  triggered.

- `fs` An override object to pass in custom filesystem methods.
  See [`path-scurry`
  docs](https://isaacs.github.io/path-scurry/interfaces/FSOption.html)
  for what can be overridden.

- `scurry` A
  [`PathScurry`](https://isaacs.github.io/path-scurry/classes/PathScurryBase.html)
  object used to traverse the file system. If the `nocase` option
  is set explicitly, then any provided `scurry` object must match
  this setting.

- `includeChildMatches` boolean, default `true`. Do not match any
  children of any matches. For example, the pattern `**\/foo`
  would match `a/foo`, but not `a/foo/b/foo` in this mode.

  This is especially useful for cases like "find all
  `node_modules` folders, but not the ones in `node_modules`".

  In order to support this, the `Ignore` implementation must
  support an `add(pattern: string)` method. If using the default
  `Ignore` class, then this is fine, but if this is set to
  `false`, and a custom `Ignore` is provided that does not have
  an `add()` method, then it will throw an error.

  For example:

  ```js
  const results = await glob(
    [
      // likely to match first, since it's just a stat
      'a/b/c/d/e/f',

      // this pattern is more complicated! It must to various readdir()
      // calls and test the results against the pattern, and that is
      // certainly going to take a little bit longer.
      //
      // So, later on, it encounters a match at 'a/b/c/d/e', but it's too
      // late to ignore a/b/c/d/e/f, because it's already been emitted.
      'a/[bdf]/?/[a-z]/*',
    ],
    { includeChildMatches: false },
  )
  ```

  It's best to only set this to `false` if you can be reasonably
  sure that no components of the pattern will potentially match
  one another's file system descendants, or if the occasional
  included child entry will not cause problems.

> [!NOTE]
> It _only_ ignores matches that would be a descendant
> of a previous match, and only if that descendant is matched
> _after_ the ancestor is encountered. Since the file system walk
> happens in indeterminate order, it's possible that a match will
> already be added before its ancestor, if multiple or braced
> patterns are used.

- `braceExpandMax` number, defaults to `10_000`. This is the
  maximum number of `{x,y,...}` patterns to expand. It is very
  unlikely that you'll need more than this, and setting it higher
  exposes the system to out-of-memory errors.

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
a path portion. With the exception of `**`, none of these match
path separators (ie, `/` on all platforms, and `\` on Windows).

- `*` Matches 0 or more characters in a single path portion.
  When alone in a path portion, it must match at least 1
  character. If `dot:true` is not specified, then `*` will not
  match against a `.` character at the start of a path portion.
- `?` Matches 1 character. If `dot:true` is not specified, then
  `?` will not match against a `.` character at the start of a
  path portion.
- `[...]` Matches a range of characters, similar to a RegExp
  range. If the first character of the range is `!` or `^` then
  it matches any character not in the range. If the first
  character is `]`, then it will be considered the same as `\]`,
  rather than the end of the character class.
- `!(pattern|pattern|pattern)` Matches anything that does not
  match any of the patterns provided. May _not_ contain `/`
  characters. Similar to `*`, if alone in a path portion, then
  the path portion must have at least one character.
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
  `{follow:true}` is passed in the options object. A pattern
  like `a/b/**` will only match `a/b` if it is a directory.
  Follows 1 symbolic link if not the first item in the pattern,
  or 0 if it is the first item, unless `follow:true` is set, in
  which case it follows all symbolic links.

`[:class:]` patterns are supported by this implementation, but
`[=c=]` and `[.symbol.]` style class patterns are not.

### Dots

If a file or directory path portion has a `.` as the first
character, then it will only match a portion of the pattern if a
literal `.` in the pattern matches that first character.

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

## Comparisons to other fnmatch/glob implementations

While strict compliance with the existing standards is a
worthwhile goal, some discrepancies exist between node-glob and
other implementations, and are intentional.

The double-star character `**` is supported by default, unless
the `noglobstar` flag is set. This is supported in the manner of
bsdglob and bash 5, where `**` only has special significance if
it is the only thing in a path part. That is, `a/**/b` will match
`a/x/y/b`, but `a/**b` will not.

> [!NOTE]
> Symlinked directories are not traversed as part of a
> `**`, though their contents may match against subsequent portions
> of the pattern. This prevents infinite loops and duplicates and
> the like. You can force glob to traverse symlinks with `**` by
> setting `{follow:true}` in the options.

There is no equivalent of the `nonull` option. A pattern that
does not find any matches simply resolves to nothing. (An empty
array, immediately ended stream, etc.)

If brace expansion is not disabled, then it is performed before
any other interpretation of the glob pattern. Thus, a pattern
like `+(a|{b),c)}`, which would not be valid in bash or zsh, is
expanded **first** into the set of `+(a|b)` and `+(a|c)`, and
those patterns are checked for validity. Since those two are
valid, matching proceeds.

The character class patterns `[:class:]` (POSIX standard named
classes) style class patterns are supported and Unicode-aware,
but `[=c=]` (locale-specific character collation weight), and
`[.symbol.]` (collating symbol), are not.

Each portion of a pattern is matched by
[minimatch](https://github.com/isaacs/minimatch), with Bash 5 as
the reference, and patterns are never compiled to regular
expressions. These are the known differences from Bash:

- If `dot` is not set, a portion of a pattern can match a file
  name that starts with `.` when extglobs before a literal `.`
  match the empty string. For example, `@(|x).*` matches `.a`.
  Bash does not match these dotfiles.
- If an extglob such as `?(a` is not closed, Bash matches the
  whole pattern as a literal string. In this module, only the
  `?(` is literal, and the rest of the pattern is still matched
  as a glob.
- A pattern is split into portions on every `/`, including a `/`
  inside an extglob, so `@(a|b/c)/*` has an extglob that is not
  closed. Bash keeps the extglob whole, and drops each alternative
  with a `/` in it, as no file name can contain a `/`. So in Bash,
  `@(a|b/c)/*` is the same as `@(a)/*`.
- With `nocase`, case is folded with Unicode simple case folding,
  one code point at a time. Bash uses the case functions of the C
  library for the current locale.

### Repeated Slashes

Unlike Bash and zsh, repeated `/` are always coalesced into a
single path separator.

### Comments and Negation

Previously, this module let you mark a pattern as a "comment" if
it started with a `#` character, or a "negated" pattern if it
started with a `!` character.

These options were deprecated in version 5, and removed in
version 6.

To specify things that should not match, use the `ignore` option.

## Windows

**Please only use forward-slashes in glob expressions.**

Though Windows uses either `/` or `\` as its path separator, only
`/` characters are used by this glob implementation. You must use
forward-slashes **only** in glob expressions. Back-slashes will
always be interpreted as escape characters, not path separators.

Results from absolute patterns such as `/foo/*` are mounted onto
the root setting using `path.join`. On Windows, this will by
default result in `/foo/*` matching `C:\foo\bar.txt`.

To automatically coerce all `\` characters to `/` in pattern
strings, **thus making it impossible to escape literal glob
characters**, you may set the `windowsPathsNoEscape` option to
`true`.

### Windows, CWDs, Drive Letters, and UNC Paths

On POSIX systems, when a pattern starts with `/`, any `cwd`
option is ignored, and the traversal starts at `/`, plus any
non-magic path portions specified in the pattern.

On Windows systems, the behavior is similar, but the concept of
an "absolute path" is somewhat more involved.

#### UNC Paths

A UNC path may be used as the start of a pattern on Windows
platforms. For example, a pattern like: `//?/x:/*` will return
all file entries in the root of the `x:` drive. A pattern like
`//ComputerName/Share/*` will return all files in the associated
share.

UNC path roots are always compared case insensitively.

#### Drive Letters

A pattern starting with a drive letter, like `c:/*`, will search
in that drive, regardless of any `cwd` option provided.

If the pattern starts with `/`, and is not a UNC path, and there
is an explicit `cwd` option set with a drive letter, then the
drive letter in the `cwd` is used as the root of the directory
traversal.

For example, `glob('/tmp', { cwd: 'c:/any/thing' })` will return
`['c:/tmp']` as the result.

If an explicit `cwd` option is not provided, and the pattern
starts with `/`, then the traversal will run on the root of the
drive provided as the `cwd` option. (That is, it is the result of
`path.resolve('/')`.)

## ReDoS Protection

Many glob implementations make a regular expression from each
pattern. A pattern such as `a*a*a*a*a*a*a*a*a*a*a`, tested against
a name such as `aaaaaaaaaaaaaaaaaaaaaaaaaaaaab` that does not
match, can make a backtracking regular expression engine try each
way that the `*` characters can split the name. The time that
this takes grows exponentially with the length of the name, so a
pattern from an untrusted source can stop a process for minutes
or more. This is a Regular Expression Denial of Service (ReDoS).

This module never makes a regular expression from a pattern.
Each portion of a pattern between `/` characters that has magic
is matched by a `Matcher` from
[@isaacs/nonrecursive-glob-match](http://npm.im/@isaacs/nonrecursive-glob-match).
A `Matcher` is not a `RegExp`, and it does not backtrack. It tests
all of the ways that the pattern can match at the same time, in
one pass over the name, so no pattern can make it try the ways one
after another. The time to match a name grows no faster than its
length times the size of the portion of the pattern, for each
kind of pattern, including nested and negated extglobs such as
`+(a|*(b|!(c)))`. The pattern above matches or fails in about a
millisecond.

The only regular expressions that a `Matcher` uses are for `[...]`
classes and case folding, and each of them only tests one
character at a time, so they can not backtrack over a name.

These limits also apply:

- The states that a `Matcher` reaches are cached, so that names
  are matched faster, but the cache has a fixed size. When it is
  full, it is cleared.
- Brace expansion makes no more than `braceExpandMax` patterns
  (10,000 by default), so a pattern such as `{1..1000000}` can not
  use an unbounded amount of memory.
- A pattern can have at most 65,536 characters. A longer pattern
  throws an error.
- An `ignore` pattern with many `**` portions that are not next to
  each other is matched with a limit on how deeply minimatch
  recurses (200 by default). Past that limit, a path is not
  treated as a match, so that path is not ignored.

The time that a walk takes still depends on the file system. A
pattern such as `**` walks every directory under the `cwd`, so if
the patterns come from an untrusted source, set the `cwd` to the
folder that they can search, and use `maxDepth` and an abort
`signal` to limit the walk. Symbolic links to directories are not
followed by `**` unless the `follow` option is set.

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
- `man bash` [Pattern
  Matching](https://www.gnu.org/software/bash/manual/html_node/Pattern-Matching.html)
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

# run the benchmarks
npm run bench

# run the benchmarks in a Docker container that is limited to 4
# CPUs and 8GB of memory, a few times, and print the medians
npm run bench:docker

# to profile javascript
npm run prof
```

## Comparison to Other JavaScript Glob Implementations

**tl;dr**

- If you want glob matching that is as faithful as possible to
  Bash pattern expansion semantics, and as fast as possible
  within that constraint, _use this module_.
- If you are reasonably sure that the patterns you will encounter
  are relatively simple, and want the fastest sync glob matcher
  out there, _use [fast-glob](http://npm.im/fast-glob)_.
- If you are reasonably sure that the patterns you will encounter
  are relatively simple, and want the convenience of
  automatically respecting `.gitignore` files, _use
  [globby](http://npm.im/globby)_.

There are some other glob matcher libraries on npm, but these
three are (in my opinion, as of 2023) the best.

---

**full explanation**

Every library reflects a set of opinions and priorities in the
trade-offs it makes. Other than this library, I can personally
recommend both [globby](http://npm.im/globby) and
[fast-glob](http://npm.im/fast-glob), though they differ in their
benefits and drawbacks.

Both have very nice APIs and are reasonably fast.

`fast-glob` is, as far as I am aware, the fastest sync glob
implementation in JavaScript today. However, there are many
cases where the choices that `fast-glob` makes in pursuit of
speed mean that its results differ from the results returned by
Bash and other sh-like shells, which may be surprising.

In the [benchmarks below](#benchmark-results), which walk over
200k files nested 4 directories deep, the sync `fast-glob` takes
about 25% less time than this module, and the async `fast-glob`
takes about 5% more, for the patterns where they return the same
results[1](#fn-webscale). However, there are some inconsistencies
with Bash matching behavior that this module does not suffer
from:

- `**` only matches files, not directories
- `..` path portions are not handled unless they appear at the
  start of the pattern
- `./!(<pattern>)` will not match any files that _start_ with
  `<pattern>`, even if they do not match `<pattern>`. For
  example, `!(9).txt` will not match `9999.txt`.
- Some brace patterns in the middle of a pattern will result in
  failing to find certain matches.
- Extglob patterns are allowed to contain `/` characters.

Globby exhibits all of the same pattern semantics as fast-glob,
(as it is a wrapper around fast-glob). In the benchmarks below,
the sync `globby` takes about 10% less time than this module, and
the async `globby` takes about 15% more, for the patterns where
they return the same results. It takes about 10-20% more time
than `fast-glob`. However, it adds some API conveniences that may
be worth the costs.

- Support for `.gitignore` and other ignore files.
- Support for negated globs (ie, patterns starting with `!`
  rather than using a separate `ignore` option).

The priority of this module is "correctness" in the sense of
performing a glob pattern expansion as faithfully as possible to
the behavior of Bash and other sh-like shells, with as much speed
as possible.

> [!NOTE]
> Prior versions of `node-glob` are _not_ on this list.
> Former versions of this module are far too slow for any cases
> where performance matters at all, and were designed with APIs
> that are extremely dated by current JavaScript standards.

---

<small id="fn-webscale">[1]: In the cases where this module
returns results and `fast-glob` doesn't, it's even faster, of
course.</small>

![lumpy space princess saying 'oh my GLOB'](https://github.com/isaacs/node-glob/raw/main/oh-my-glob.gif)

### Benchmark Results

These are from `npm run bench:docker`, which runs the benchmarks
in a Linux Docker container that is limited to 4 CPUs and 8GB of
memory, with the test files in memory. Each time is the median of
3 runs, and includes starting node.

The first number is time, smaller is better.

The second number is the count of results returned. The totals at
the end are over all of the patterns, including the ones where the
implementations return different results.

```
--- pattern: '{0000,0,1111,1}/{0000,0,1111,1}/{0000,0,1111,1}/**' ---
~~ sync ~~
fast-glob sync           	0m0.046s  1600
globby sync              	0m0.050s  1600
fs.globSync              	0m0.040s  1776
current globSync mjs     	0m0.048s  1776
current glob syncStream  	0m0.046s  1776
~~ async ~~
fast-glob async          	0m0.047s  1600
globby async             	0m0.053s  1600
fs.glob                  	0m0.054s  1776
current glob async mjs   	0m0.050s  1776
current glob stream      	0m0.051s  1776

--- pattern: '**' ---
~~ sync ~~
fast-glob sync           	0m0.340s  200002
globby sync              	0m0.423s  200002
fs.globSync              	0m0.692s  222223
current globSync mjs     	0m0.437s  222223
current glob syncStream  	0m0.408s  222223
~~ async ~~
fast-glob async          	0m0.491s  200002
globby async             	0m0.569s  200002
fs.glob                  	0m1.889s  222223
current glob async mjs   	0m0.464s  222223
current glob stream      	0m0.442s  222223

--- pattern: '**/..' ---
~~ sync ~~
fast-glob sync           	0m0.260s  0
globby sync              	0m0.432s  200002
fs.globSync              	0m0.531s  2222
current globSync mjs     	0m0.351s  2222
current glob syncStream  	0m0.347s  2222
~~ async ~~
fast-glob async          	0m0.381s  0
globby async             	0m0.569s  200002
fs.glob                  	0m1.632s  2222
current glob async mjs   	0m0.373s  2222
current glob stream      	0m0.366s  2222

--- pattern: './**/0/**/0/**/0/**/0/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.263s  10
globby sync              	0m0.267s  10
fs.globSync              	0m0.547s  10
current globSync mjs     	0m0.335s  10
current glob syncStream  	0m0.334s  10
~~ async ~~
fast-glob async          	0m0.374s  10
globby async             	0m0.388s  10
fs.glob                  	0m1.676s  10
current glob async mjs   	0m0.342s  10
current glob stream      	0m0.340s  10

--- pattern: './**/[01]/**/[12]/**/[23]/**/[45]/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.270s  160
globby sync              	0m0.269s  160
fs.globSync              	0m0.588s  160
current globSync mjs     	0m0.344s  160
current glob syncStream  	0m0.348s  160
~~ async ~~
fast-glob async          	0m0.380s  160
globby async             	0m0.401s  160
fs.glob                  	0m1.715s  160
current glob async mjs   	0m0.346s  160
current glob stream      	0m0.345s  160

--- pattern: './**/0/**/0/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.269s  5230
globby sync              	0m0.276s  5230
fs.globSync              	0m0.555s  5230
current globSync mjs     	0m0.343s  5230
current glob syncStream  	0m0.340s  5230
~~ async ~~
fast-glob async          	0m0.381s  5230
globby async             	0m0.399s  5230
fs.glob                  	0m1.662s  5230
current glob async mjs   	0m0.345s  5230
current glob stream      	0m0.344s  5230

--- pattern: '**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.336s  200000
globby sync              	0m0.425s  200000
fs.globSync              	0m0.697s  200000
current globSync mjs     	0m0.438s  200000
current glob syncStream  	0m0.411s  200000
~~ async ~~
fast-glob async          	0m0.489s  200000
globby async             	0m0.563s  200000
fs.glob                  	0m1.866s  200000
current glob async mjs   	0m0.467s  200000
current glob stream      	0m0.429s  200000

--- pattern: '{**/*.txt,**/?/**/*.txt,**/?/**/?/**/*.txt,**/?/**/?/**/?/**/*.txt,**/?/**/?/**/?/**/?/**/*.txt}' ---
~~ sync ~~
fast-glob sync           	0m0.339s  200000
globby sync              	0m0.428s  200000
fs.globSync              	0m1.093s  200000
current globSync mjs     	0m0.463s  200000
current glob syncStream  	0m0.436s  200000
~~ async ~~
fast-glob async          	0m0.485s  200000
globby async             	0m0.570s  200000
fs.glob                  	0m2.303s  200000
current glob async mjs   	0m0.499s  200000
current glob stream      	0m0.480s  200000

--- pattern: '**/5555/0000/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.265s  1000
globby sync              	0m0.269s  1000
fs.globSync              	0m0.525s  1000
current globSync mjs     	0m0.356s  1000
current glob syncStream  	0m0.360s  1000
~~ async ~~
fast-glob async          	0m0.375s  1000
globby async             	0m0.383s  1000
fs.glob                  	0m1.592s  1000
current glob async mjs   	0m0.361s  1000
current glob stream      	0m0.366s  1000

--- pattern: './**/0/**/../[01]/**/0/../**/0/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.261s  0
globby sync              	0m0.263s  0
fs.globSync              	0m0.754s  4880
current globSync mjs     	0m0.351s  4880
current glob syncStream  	0m0.350s  4880
~~ async ~~
fast-glob async          	0m0.363s  0
globby async             	0m0.382s  0
fs.glob                  	0m1.869s  4880
current glob async mjs   	0m0.370s  4880
current glob stream      	0m0.367s  4880

--- pattern: '**/????/????/????/????/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.297s  100000
globby sync              	0m0.349s  100000
fs.globSync              	0m0.681s  100000
current globSync mjs     	0m0.404s  100000
current glob syncStream  	0m0.399s  100000
~~ async ~~
fast-glob async          	0m0.440s  100000
globby async             	0m0.484s  100000
fs.glob                  	0m1.805s  100000
current glob async mjs   	0m0.418s  100000
current glob stream      	0m0.413s  100000

--- pattern: './{**/?{/**/?{/**/?{/**/?,,,,},,,,},,,,},,,}/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.337s  200000
globby sync              	0m0.427s  200000
fs.globSync              	0m1.264s  200000
current globSync mjs     	0m0.465s  200000
current glob syncStream  	0m0.446s  200000
~~ async ~~
fast-glob async          	0m0.491s  200000
globby async             	0m0.562s  200000
fs.glob                  	0m2.508s  200000
current glob async mjs   	0m0.494s  200000
current glob stream      	0m0.473s  200000

--- pattern: '**/!(0|9).txt' ---
~~ sync ~~
fast-glob sync           	0m0.327s  160000
globby sync              	0m0.404s  160000
fs.globSync              	0m0.687s  180000
current globSync mjs     	0m0.462s  180000
current glob syncStream  	0m0.418s  180000
~~ async ~~
fast-glob async          	0m0.474s  160000
globby async             	0m0.552s  160000
fs.glob                  	0m1.876s  180000
current glob async mjs   	0m0.465s  180000
current glob stream      	0m0.436s  180000

--- pattern: './{*/**/../{*/**/../{*/**/../{*/**/../{*/**,,,,},,,,},,,,},,,,},,,,}/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.262s  0
globby sync              	0m0.264s  0
fs.globSync              	0m0.933s  200000
current globSync mjs     	0m0.557s  200000
current glob syncStream  	0m0.541s  200000
~~ async ~~
fast-glob async          	0m0.377s  0
globby async             	0m0.414s  0
fs.glob                  	0m2.135s  200000
current glob async mjs   	0m0.662s  200000
current glob stream      	0m0.639s  200000

--- pattern: './*/**/../*/**/../*/**/../*/**/../*/**/../*/**/../*/**/../*/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.256s  0
globby sync              	0m0.262s  0
fs.globSync              	0m0.716s  200000
current globSync mjs     	0m0.519s  200000
current glob syncStream  	0m0.494s  200000
~~ async ~~
fast-glob async          	0m0.363s  0
globby async             	0m0.374s  0
fs.glob                  	0m1.870s  200000
current glob async mjs   	0m0.565s  200000
current glob stream      	0m0.542s  200000

--- pattern: './*/**/../*/**/../*/**/../*/**/../*/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.259s  0
globby sync              	0m0.262s  0
fs.globSync              	0m0.725s  200000
current globSync mjs     	0m0.488s  200000
current glob syncStream  	0m0.459s  200000
~~ async ~~
fast-glob async          	0m0.366s  0
globby async             	0m0.379s  0
fs.glob                  	0m1.878s  200000
current glob async mjs   	0m0.522s  200000
current glob stream      	0m0.495s  200000

--- pattern: './0/**/../1/**/../2/**/../3/**/../4/**/../5/**/../6/**/../7/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.050s  0
globby sync              	0m0.055s  0
fs.globSync              	0m1.134s  28970
current globSync mjs     	0m0.290s  28970
current glob syncStream  	0m0.287s  28970
~~ async ~~
fast-glob async          	0m0.055s  0
globby async             	0m0.064s  0
fs.glob                  	0m1.745s  28970
current glob async mjs   	0m0.307s  28970
current glob stream      	0m0.301s  28970

--- pattern: './**/?/**/?/**/?/**/?/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.305s  100000
globby sync              	0m0.353s  100000
fs.globSync              	0m0.750s  100000
current globSync mjs     	0m0.400s  100000
current glob syncStream  	0m0.403s  100000
~~ async ~~
fast-glob async          	0m0.466s  100000
globby async             	0m0.513s  100000
fs.glob                  	0m1.900s  100000
current glob async mjs   	0m0.415s  100000
current glob stream      	0m0.412s  100000

--- pattern: '**/*/**/*/**/*/**/*/**' ---
~~ sync ~~
fast-glob sync           	0m0.371s  200000
globby sync              	0m0.470s  200000
fs.globSync              	0m0.907s  220000
current globSync mjs     	0m0.476s  220000
current glob syncStream  	0m0.452s  220000
~~ async ~~
fast-glob async          	0m0.526s  200000
globby async             	0m0.611s  200000
fs.glob                  	0m2.094s  220000
current glob async mjs   	0m0.521s  220000
current glob stream      	0m0.498s  220000

--- pattern: './**/*/**/*/**/*/**/*/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.367s  200000
globby sync              	0m0.459s  200000
fs.globSync              	0m0.911s  200000
current globSync mjs     	0m0.481s  200000
current glob syncStream  	0m0.454s  200000
~~ async ~~
fast-glob async          	0m0.519s  200000
globby async             	0m0.596s  200000
fs.glob                  	0m2.140s  200000
current glob async mjs   	0m0.508s  200000
current glob stream      	0m0.483s  200000

--- pattern: '**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.336s  200000
globby sync              	0m0.425s  200000
fs.globSync              	0m0.698s  200000
current globSync mjs     	0m0.437s  200000
current glob syncStream  	0m0.430s  200000
~~ async ~~
fast-glob async          	0m0.483s  200000
globby async             	0m0.565s  200000
fs.glob                  	0m1.874s  200000
current glob async mjs   	0m0.462s  200000
current glob stream      	0m0.468s  200000

--- pattern: './**/**/**/**/**/**/**/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.346s  200000
globby sync              	0m0.442s  200000
fs.globSync              	0m0.721s  200000
current globSync mjs     	0m0.437s  200000
current glob syncStream  	0m0.417s  200000
~~ async ~~
fast-glob async          	0m0.522s  200000
globby async             	0m0.595s  200000
fs.glob                  	0m1.892s  200000
current glob async mjs   	0m0.486s  200000
current glob stream      	0m0.468s  200000

--- pattern: '**/*/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.343s  200000
globby sync              	0m0.434s  200000
fs.globSync              	0m0.753s  200000
current globSync mjs     	0m0.448s  200000
current glob syncStream  	0m0.446s  200000
~~ async ~~
fast-glob async          	0m0.516s  200000
globby async             	0m0.576s  200000
fs.glob                  	0m1.936s  200000
current glob async mjs   	0m0.492s  200000
current glob stream      	0m0.465s  200000

--- pattern: '**/*/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.341s  200000
globby sync              	0m0.429s  200000
fs.globSync              	0m0.772s  200000
current globSync mjs     	0m0.451s  200000
current glob syncStream  	0m0.434s  200000
~~ async ~~
fast-glob async          	0m0.492s  200000
globby async             	0m0.565s  200000
fs.glob                  	0m1.927s  200000
current glob async mjs   	0m0.480s  200000
current glob stream      	0m0.447s  200000

--- pattern: '**/[0-9]/**/*.txt' ---
~~ sync ~~
fast-glob sync           	0m0.307s  100000
globby sync              	0m0.347s  100000
fs.globSync              	0m0.667s  100000
current globSync mjs     	0m0.393s  100000
current glob syncStream  	0m0.396s  100000
~~ async ~~
fast-glob async          	0m0.458s  100000
globby async             	0m0.490s  100000
fs.glob                  	0m1.894s  100000
current glob async mjs   	0m0.433s  100000
current glob stream      	0m0.426s  100000

--- total of the medians ---
fast-glob sync (sync)               	7.153s
globby sync (sync)                  	8.484s
fs.globSync (sync)                  	18.341s
current globSync mjs (sync)         	10.174s
current glob syncStream (sync)      	9.856s
fast-glob async (async)             	10.314s
globby async (async)                	11.617s
fs.glob (async)                     	45.732s
current glob async mjs (async)      	10.847s
current glob stream (async)         	10.496s
```
