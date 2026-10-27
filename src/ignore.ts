// give it a pattern, and it'll be able to tell you if
// a given path should be ignored.
// Ignoring a path ignores its children if the pattern ends in /**
// Ignores are always parsed in dot:true mode

import type { MinimatchOptions } from 'minimatch'
import { escape, Minimatch } from 'minimatch'
import type { Path } from 'path-scurry'
import { Pattern } from './pattern.js'
import type { GlobWalkerOpts } from './walker.js'

export interface IgnoreLike {
  ignored?: (p: Path) => boolean
  childrenIgnored?: (p: Path) => boolean
  add?: (ignore: string) => void
}

const defaultPlatform: NodeJS.Platform =
  (
    typeof process === 'object' &&
    process &&
    typeof process.platform === 'string'
  ) ?
    process.platform
  : 'linux'

/**
 * Class used to process ignored patterns
 */
export class Ignore implements IgnoreLike {
  relative: Minimatch[]
  relativeChildren: Minimatch[]
  absolute: Minimatch[]
  absoluteChildren: Minimatch[]
  platform: NodeJS.Platform
  mmopts: MinimatchOptions
  /**
   * The escaped glob for the directory that a pattern starting with
   * `/` is rooted at, with no trailing `/`.
   */
  slashRoot: string

  /**
   * Patterns that start with `/` (but not drive letters or UNC paths
   * on Windows) start at the `root` option if it is set, or else at
   * the root of `cwd`, the same as non-ignored patterns. If `cwd` is
   * not provided, they start at `/`.
   */
  constructor(
    ignored: string[],
    {
      nobrace,
      nocase,
      noext,
      noglobstar,
      normalize,
      platform = defaultPlatform,
      root,
      windowsPathsNoEscape,
      allowWindowsEscape,
    }: GlobWalkerOpts,
    cwd?: Path,
  ) {
    this.relative = []
    this.absolute = []
    this.relativeChildren = []
    this.absoluteChildren = []
    this.platform = platform
    windowsPathsNoEscape =
      !!windowsPathsNoEscape || allowWindowsEscape === false
    this.mmopts = {
      dot: true,
      nobrace,
      nocase,
      noext,
      noglobstar,
      normalize,
      optimizationLevel: 2,
      platform,
      nocomment: true,
      nonegate: true,
      windowsPathsNoEscape,
    }
    const slashRoot = cwd?.resolve(root ?? '/').fullpath() ?? '/'
    this.slashRoot = escape(
      slashRoot.replace(/\\/g, '/').replace(/\/$/, ''),
      { windowsPathsNoEscape },
    )
    for (const ign of ignored) this.add(ign)
  }

  add(ign: string) {
    // this is a little weird, but it gives us a clean set of optimized
    // minimatch matchers, without getting tripped up if one of them
    // ends in /** inside a brace section, and it's only inefficient at
    // the start of the walk, not along it.
    // It'd be nice if the Pattern class just had a .test() method, but
    // handling globstars is a bit of a pita, and that code already lives
    // in minimatch anyway.
    // Another way would be if maybe Minimatch could take its set/globParts
    // as an option, and then we could at least just use Pattern to test
    // for absolute-ness.
    // Yet another way, Minimatch could take an array of glob strings, and
    // a cwd option, and do the right thing.
    const mm = new Minimatch(ign, this.mmopts)
    for (let i = 0; i < mm.set.length; i++) {
      const parsed = mm.set[i]
      const globParts = mm.globParts[i]
      /* c8 ignore start */
      if (!parsed || !globParts) {
        throw new Error('invalid pattern object')
      }
      // strip off leading ./ portions
      // https://github.com/isaacs/node-glob/issues/570
      while (parsed[0] === '.' && globParts[0] === '.') {
        parsed.shift()
        globParts.shift()
      }
      /* c8 ignore stop */
      const p = new Pattern(parsed, globParts, 0, this.platform)
      const glob =
        p.root() === '/' ?
          `${this.slashRoot}/${p.rest()?.globString() ?? ''}`
        : p.globString()
      const m = new Minimatch(glob, this.mmopts)
      const children = globParts[globParts.length - 1] === '**'
      const absolute = p.isAbsolute()
      if (absolute) this.absolute.push(m)
      else this.relative.push(m)
      if (children) {
        if (absolute) this.absoluteChildren.push(m)
        else this.relativeChildren.push(m)
      }
    }
  }

  ignored(p: Path): boolean {
    const fullpath = p.fullpath()
    const fullpaths = `${fullpath}/`
    const relative = p.relative() || '.'
    const relatives = `${relative}/`
    for (const m of this.relative) {
      if (m.match(relative) || m.match(relatives)) return true
    }
    for (const m of this.absolute) {
      if (m.match(fullpath) || m.match(fullpaths)) return true
    }
    return false
  }

  childrenIgnored(p: Path): boolean {
    const fullpath = `${p.fullpath()}/`
    const relative = `${p.relative() || '.'}/`
    for (const m of this.relativeChildren) {
      if (m.match(relative)) return true
    }
    for (const m of this.absoluteChildren) {
      if (m.match(fullpath)) return true
    }
    return false
  }
}
