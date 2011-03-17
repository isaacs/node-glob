
node-glob - Globbing for Node

## One day, in <irc://irc.freenode.net#node.js>...

<code>[4:46pm] <a href="http://tinyclouds.org/">_ry</a>: it would be good to
have a file system Glob functionality (to get an array of
filenames)</code>

## // 9 months later...

    npm install glob

(You can also install it by doing `node-waf configure build` and then
linking or copying the folder into your project's `node_modules`
directory.)

## Wtf's a "glob"?

A glob is a pattern-matching syntax that shells use.  Like when you do
`rm *.js`, the `*.js` is a glob.

You can do nifty things with them.

## Supported Environments

* Macintosh OS X (Darwin)
* FreeBSD
* NetBSD
* Linux
* Solaris

If it doesn't work on one of those environments, please <a
href="https://github.com/isaacs/node-glob/issues">post a bug</a>.

## Usage

This is a binding to
[glob(3)](http://www.daemon-systems.org/man/glob.3.html) and
[fnmatch(3)](http://www.daemon-systems.org/man/fnmatch.3.html).  It includes
a statically compiled port of the NetBSD glob and fnmatch
programs, so it might not exactly match what `#include <fnmatch.h>`
or `#include <glob.h>` implements on your system.

To load the library:

    var glob = require("glob")

## Methods

### glob

Search through the filesystem asynchronously.

#### Params

* pattern: String
* flags: int, Optional (see below)
* cb: function

#### Return

NOTHING!

#### Example

    glob(pattern, flags, function (er, matches) {
      // if an error occurred, it's in er.
      // otherwise, "matches" is an array of filenames.
      ...
    })

### globSync

Search through the filesystem synchronously

#### Params

* pattern: String
* flags: int, Optional (see below)

#### Return

Array of strings that match.

#### Example

    var matches = glob.globSync(pattern, flags) // throws on error

### fnmatch

Test if a string matches a pattern. (no i/o performed)

#### Params

* pattern: String
* str: String to test
* flags: int, Optional (see below)

#### Example

    var isMatch = glob.fnmatch(pattern, str, flags)


## Flags

The behavior of glob and fnmatch are modified by several bitwise flags.

The flags are defined on the main glob object.  If you have an integer,
and want to look up which flag it corresponds to, you can look it up on
the glob/globSync functions if it is a glob flag, or on the fnmatch
function if it is an fnmatch flag.

That is, `fnmatch[fnmatch.FNM_CASEFOLD] === 'FNM_CASEFOLD'`.

* `GLOB_DEFAULT` Used if no flags are passed to `glob()` or
  `globSync()`. Equivalent of
  `GLOB_BRACE|GLOB_LIMIT|GLOB_STAR|GLOB_MARK|GLOB_TILDE`.
* `FNM_DEFAULT` Used if no flags are passed to `fnmatch()`.  Equivalent
  of `FNM_PATHNAME|FNM_PERIOD`.
* `GLOB_MARK` Append / to matching directories.
* `GLOB_NOCHECK` Return pattern itself if nothing matches.
* `GLOB_NOSORT` Don't sort.
* `GLOB_NOESCAPE` Disable backslash escaping.
* `GLOB_NOSPACE` Malloc call failed.
* `GLOB_ABORTED` Unignored error.
* `GLOB_NOMATCH` No match, and GLOB_NOCHECK was not set.
* `GLOB_NOSYS` Implementation does not support function.
* `GLOB_BRACE` Expand braces ala csh.
* `GLOB_NOMAGIC` GLOB_NOCHECK without magic chars (csh).
* `GLOB_LIMIT` Limit memory used by matches to ARG_MAX
* `GLOB_TILDE` Expand tilde names from the passwd file.
* `GLOB_PERIOD` Allow metachars to match leading periods.
* `GLOB_NO_DOTDIRS` Make . and .. vanish from wildcards.
* `GLOB_STAR` Use glob `**` to recurse directories
* `GLOB_QUOTE` source compatibility
* `FNM_NOMATCH` Match failed.
* `FNM_NOSYS` Function not implemented.
* `FNM_NORES` Out of resources
* `FNM_NOESCAPE` Disable backslash escaping.
* `FNM_PATHNAME` Slash must be matched by slash.
* `FNM_PERIOD` Period must be matched by period.
* `FNM_CASEFOLD` Pattern is matched case-insensitive
* `FNM_LEADING_DIR` Ignore /<tail> after Imatch.

## Bugs

See <https://github.com/isaacs/node-glob/issues>.
