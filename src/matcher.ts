// this is a much more "mini" minimatch, optimized for use in a recursive
// glob walk.  So we build up the 2d array of pattern portions, and do
// the preprocessing to make the glob patterns as efficient as possible,
// but do *not* generate the big honkin complicated regexp to test an
// entire path string.

import expand from 'brace-expansion'

export const GLOBSTAR = Symbol('**')

import { GlobList, Compiled, Pattern } from './pattern.js'

export type MMPattern = string | RegExp | typeof GLOBSTAR

export interface MatcherOpts {
  dot?: boolean
  nocase?: boolean
  noext?: boolean
  noglobstar?: boolean
  nobrace?: boolean
  windowsPathsNoEscape?: boolean
  platform?: typeof process.platform
}

/* c8 ignore start */
// TODO: make this non-optional, pass in via Glob options
const defaultPlatform: typeof process.platform =
  typeof process === 'object' &&
  !!process &&
  typeof process.platform === 'string'
    ? process.platform
    : 'linux'
/* c8 ignore stop */

export class Matcher {
  options: MatcherOpts
  globLists: GlobList[]
  patterns: Pattern[]

  dot: boolean
  nocase: boolean
  noext: boolean
  noglobstar: boolean
  nobrace: boolean
  windowsPathsNoEscape: boolean
  platform: typeof process.platform
  isWindows: boolean

  constructor(patterns: string | string[], opts: MatcherOpts = {}) {
    const {
      dot = false,
      nocase,
      noext = false,
      noglobstar = false,
      nobrace = false,
      windowsPathsNoEscape = false,
      platform = defaultPlatform,
    } = opts
    this.dot = dot
    this.noext = noext
    this.noglobstar = noglobstar
    this.nobrace = nobrace
    this.windowsPathsNoEscape = windowsPathsNoEscape
    this.platform = platform
    this.nocase =
      nocase !== undefined
        ? nocase
        : this.platform === 'win32' || this.platform === 'darwin'
    this.isWindows = this.platform === 'win32'

    opts = {
      dot: this.dot,
      nocase: this.nocase,
      noext: this.noext,
      noglobstar: this.noglobstar,
      nobrace: this.nobrace,
      windowsPathsNoEscape: this.windowsPathsNoEscape,
      platform: this.platform,
    }
    this.options = opts

    if (!patterns) throw new TypeError('pattern required')
    if (!Array.isArray(patterns)) patterns = [patterns]
    if (opts.windowsPathsNoEscape) {
      patterns = patterns.map(p => p.replace(/\\/g, '/'))
    }
    this.globLists = this.preprocess(
      patterns
        .map(p => braceExpand(p, this.options))
        .reduce((ps, p) => ps.concat(p), [])
        .map(p => this.splitGlobString(p))
        .filter(gl => !!gl.length)
    ) as GlobList[]

    const compiled: Compiled = new Map()
    this.patterns = this.globLists.map(
      gl => new Pattern(gl, 0, compiled, opts)
    )
  }

  splitGlobString(globString: string) {
    const parts = globString.split('/')
    // canonincalize UNC paths and drives, make the first
    // pattern the whole root ending in / for absolute patterns.
    if (this.isUNC(parts)) {
      const [p0, p1, p2] = parts
      parts.shift()
      parts.shift()
      parts.shift()
      parts.unshift([p0, p1, p2, ''].join('/').toUpperCase())
    } else if (this.isDrive(parts)) {
      const drive = parts[0].toUpperCase() + '/'
      parts.shift()
      parts.unshift(drive)
    } else if (parts[0] === '') {
      parts[0] = '/'
    }

    // now strip any empty parts
    return parts.filter((p, i) => !!p || i === parts.length - 1)
  }

  isDrive(pl: string[]): boolean {
    return (
      this.isWindows &&
      typeof pl[0] === 'string' &&
      /^[a-z]:$/i.test(pl[0])
    )
  }

  isUNC(pl: string[]): boolean {
    return (
      this.isWindows &&
      pl[0] === '' &&
      pl[1] === '' &&
      typeof pl[2] === 'string' &&
      !!pl[2] &&
      typeof pl[3] === 'string' &&
      !!pl[3]
    )
  }

  preprocess(globParts: string[][]) {
    // if we're not in globstar mode, then turn all ** into *
    if (this.noglobstar) {
      for (let i = 0; i < globParts.length; i++) {
        for (let j = 0; j < globParts[i].length; j++) {
          if (globParts[i][j] === '**') {
            globParts[i][j] = '*'
          }
        }
      }
    }

    globParts = this.firstPhasePreProcess(globParts)
    globParts = this.secondPhasePreProcess(globParts)

    return globParts
  }

  // First phase: single-pattern processing
  // <pre> is 1 or more portions
  // <rest> is 1 or more portions
  // <p> is any portion other than ., .., '', or **
  // <e> is . or ''
  //
  // **/.. is *brutal* for filesystem walking performance, because
  // it effectively resets the recursive walk each time it occurs,
  // and ** cannot be reduced out by a .. pattern part like a regexp
  // or most strings (other than .., ., and '') can be.
  //
  // <pre>/**/../<p>/<rest> -> {<pre>/../<p>/<rest>,<pre>/**/<p>/<rest>}
  // <pre>/<e>/<rest> -> <pre>/<rest>
  // <pre>/<p>/../<rest> -> <pre>/<rest>
  // **/**/<rest> -> **/<rest>
  //
  // **/*/<rest> -> */**/<rest> <== not valid because ** doesn't follow
  // this WOULD be allowed if ** did follow symlinks, or * didn't
  firstPhasePreProcess(globParts: string[][]) {
    let didSomething = false
    do {
      didSomething = false
      // <pre>/**/../<p>/<rest> -> {<pre>/../<p>/<rest>,<pre>/**/<p>/<rest>}
      for (let parts of globParts) {
        let gs: number = -1
        while (-1 !== (gs = parts.indexOf('**', gs + 1))) {
          let gss: number = gs
          while (parts[gss + 1] === '**') {
            // <pre>/**/**/<rest> -> <pre>/**/<rest>
            gss++
          }
          // eg, if gs is 2 and gss is 4, that means we have 3 **
          // parts, and can remove 2 of them.
          if (gss > gs) {
            parts.splice(gs + 1, gss - gs)
          }

          let next = parts[gs + 1]
          const p = parts[gs + 2]
          if (next !== '..') continue
          if (!p || p === '.' || p === '..') continue
          didSomething = true
          // edit parts in place, and push the new one
          parts.splice(gs, 1)
          const other = parts.slice(0)
          other[gs] = '**'
          globParts.push(other)
          gs--
        }

        // <pre>/<e>/<rest> -> <pre>/<rest>
        for (let i = 1; i < parts.length - 1; i++) {
          const p = parts[i]
          // don't squeeze out UNC patterns
          if (i === 1 && p === '' && parts[0] === '') continue
          if (p === '.' || p === '') {
            didSomething = true
            parts.splice(i, 1)
            i--
          }
        }
        if (parts[0] === '.') {
          didSomething = true
          parts.shift()
        }

        // <pre>/<p>/../<rest> -> <pre>/<rest>
        let dd: number = 0
        while (-1 !== (dd = parts.indexOf('..', dd + 1))) {
          const p = parts[dd - 1]
          if (p && p !== '.' && p !== '..' && p !== '**') {
            didSomething = true
            parts.splice(dd - 1, 2)
            if (parts.length === 0) parts.push('')
            dd -= 2
          }
        }
      }
    } while (didSomething)

    return globParts
  }

  // second phase: multi-pattern dedupes
  // {<pre>/*/<rest>,<pre>/<p>/<rest>} -> <pre>/*/<rest>
  // {<pre>/<rest>,<pre>/<rest>} -> <pre>/<rest>
  // {<pre>/**/<rest>,<pre>/<rest>} -> <pre>/**/<rest>
  //
  // {<pre>/**/<rest>,<pre>/**/<p>/<rest>} -> <pre>/**/<rest>
  // ^-- not valid because ** doens't follow symlinks
  secondPhasePreProcess(globParts: string[][]): string[][] {
    for (let i = 0; i < globParts.length - 1; i++) {
      for (let j = i + 1; j < globParts.length; j++) {
        const matched = this.partsMatch(globParts[i], globParts[j])
        if (!matched) continue
        globParts[i] = matched
        globParts[j] = []
      }
    }
    return globParts.filter(gs => gs.length)
  }

  partsMatch(a: string[], b: string[]): false | string[] {
    let ai = 0
    let bi = 0
    let result: string[] = []
    let which: string = ''
    while (ai < a.length && bi < b.length) {
      if (a[ai] === b[bi]) {
        result.push(which === 'b' ? b[bi] : a[ai])
        ai++
        bi++
      } else if (a[ai] === '**' && b[bi] === a[ai + 1]) {
        result.push(a[ai])
        ai++
      } else if (b[bi] === '**' && a[ai] === b[bi + 1]) {
        result.push(b[bi])
        bi++
      } else if (
        a[ai] === '*' &&
        b[bi] &&
        !b[bi].startsWith('.') &&
        b[bi] !== '**'
      ) {
        if (which === 'b') return false
        which = 'a'
        result.push(a[ai])
        ai++
        bi++
      } else if (
        b[bi] === '*' &&
        a[ai] &&
        (this.dot || !a[ai].startsWith('.')) &&
        a[ai] !== '**'
      ) {
        if (which === 'a') return false
        which = 'b'
        result.push(b[bi])
        ai++
        bi++
      } else {
        return false
      }
    }
    // if we fall out of the loop, it means they two are identical
    // as long as their lengths match
    return a.length === b.length && result
  }
}

export const braceExpand = (
  pattern: string,
  options: MatcherOpts = {}
) => {
  assertValidPattern(pattern)

  // Thanks to Yeting Li <https://github.com/yetingli> for
  // improving this regexp to avoid a ReDOS vulnerability.
  if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
    // shortcut. no need to expand.
    return [pattern]
  }

  return expand(pattern)
}

const MAX_PATTERN_LENGTH = 1024 * 64
const assertValidPattern: (pattern: any) => void = (
  pattern: any
): asserts pattern is string => {
  if (typeof pattern !== 'string') {
    throw new TypeError('invalid pattern')
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new TypeError('pattern is too long')
  }
}
