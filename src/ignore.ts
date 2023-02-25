// give it a pattern, and it'll be able to tell you if
// a given path should be ignored.
// Ignoring a path ignores its children if the pattern ends in /**
// Ignores are always parsed in dot:true mode

import { Minimatch } from 'minimatch'
import { Path } from 'path-scurry'
import { Pattern } from './pattern.js'
import { GlobWalkerOpts } from './walker.js'

const defaultPlatform: NodeJS.Platform =
  typeof process === 'object' &&
  process &&
  typeof process.platform === 'string'
    ? process.platform
    : 'linux'

export class Ignore {
  platform: NodeJS.Platform
  nocase: boolean
  relative: Minimatch[]
  relativeChildren: Minimatch[]
  absolute: Minimatch[]
  absoluteChildren: Minimatch[]

  constructor(
    ignored: string[],
    { platform = defaultPlatform, nocase }: GlobWalkerOpts
  ) {
    this.platform = platform
    this.nocase = !!nocase
    this.relative = []
    this.absolute = []
    this.relativeChildren = []
    this.absoluteChildren = []
    const mmopts = {
      platform: this.platform,
      optimizationLevel: 2,
      nocaseMagicOnly: true,
      dot: true,
      nocase,
    }

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
    for (const ign of ignored) {
      const mm = new Minimatch(ign, mmopts)
      for (let i = 0; i < mm.set.length; i++) {
        const parsed = mm.set[i]
        const globParts = mm.globParts[i]
        const p = new Pattern(parsed, globParts, 0, this.platform)
        const m = new Minimatch(p.globString(), mmopts)
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
  }

  ignored(p: Path): boolean {
    const fullpath = p.fullpath()
    const relative = p.relative()
    for (const m of this.absolute) {
      if (m.match(fullpath)) return true
    }
    for (const m of this.relative) {
      if (m.match(relative)) return true
    }
    return false
  }

  childrenIgnored(p: Path): boolean {
    const fullpath = p.fullpath()
    const relative = p.relative()
    for (const m of this.absoluteChildren) {
      if (m.match(fullpath)) return true
    }
    for (const m of this.relativeChildren) {
      if (m.match(relative)) return true
    }
    return false
  }
}
