// synchronous utility for filtering entries and calculating subwalks

import { GLOBSTAR } from 'minimatch'
import { Path } from 'path-scurry'
import { MMPattern, Pattern } from './pattern.js'

class HasWalkedCache {
  store: Map<Path, Set<string>>
  constructor(store: Map<Path, Set<string>> = new Map()) {
    this.store = store
  }
  copy() {
    return new HasWalkedCache(new Map(this.store))
  }
  hasWalked(target: Path, pattern: Pattern) {
    return this.store.get(target)?.has(pattern.globString())
  }
  storeWalked(target: Path, pattern: Pattern) {
    const cached = this.store.get(target)
    if (cached) cached.add(pattern.globString())
    else this.store.set(target, new Set([pattern.globString()]))
  }
}

class MatchRecord {
  store: Map<Path, number> = new Map()
  add(target: Path, absolute: boolean, ifDir: boolean) {
    const n = (absolute ? 2 : 0) | (ifDir ? 1 : 0)
    const current = this.store.get(target) || 0
    this.store.set(target, n & current)
  }
  // match, absolute, ifdir
  entries(): [Path, boolean, boolean][] {
    return [...this.store.entries()].map(([path, n]) => [
      path,
      !!(n & 2),
      !!(n & 1),
    ])
  }
}

class SubWalks {
  store: Map<Path, Pattern[]> = new Map()
  patterns: Map<string, Pattern> = new Map()
  add(target: Path, pattern: Pattern) {
    if (!target.canReaddir()) return
    if (target.isSymbolicLink() && pattern.isGlobstar()) return
    const subs = this.store.get(target)
    if (subs) subs.push(pattern)
    else this.store.set(target, [pattern])
  }
  get(target: Path): Pattern[] {
    return this.store.get(target) || []
  }
  entries(): [Path, Pattern[]][] {
    return this.keys().map(k => [k, this.store.get(k) as Pattern[]])
  }
  keys(): Path[] {
    return [...this.store.keys()].filter(t => {
      if (!t.canReaddir()) return false
      if (
        t.isSymbolicLink() &&
        !this.store.get(t)?.some(p => p.isRegExp())
      ) {
        return false
      }
      return true
    })
  }
}

export class Processor {
  hasWalked: HasWalkedCache
  matches = new MatchRecord()
  subwalks = new SubWalks()
  patterns?: Pattern[]

  constructor(hasWalked?: HasWalkedCache) {
    this.hasWalked = hasWalked ? hasWalked.copy() : new HasWalkedCache()
  }

  processPatterns(target: Path, patterns: Pattern[]) {
    this.patterns = patterns
    const processingSet: [Path, Pattern][] = patterns.map(p => [target, p])

    // map of paths to the magic-starting subwalks they need to walk
    // first item in patterns is the filter

    for (let [t, pattern] of processingSet) {
      if (this.hasWalked.hasWalked(t, pattern)) continue
      this.hasWalked.storeWalked(t, pattern)

      const root = pattern.root()
      const absolute = pattern.isAbsolute()

      // start absolute patterns at root
      if (root) {
        t = t.resolve(root)
        const rest = pattern.rest()
        if (!rest) {
          this.matches.add(t, true, false)
          continue
        } else {
          pattern = rest
        }
      }

      // walk down strings
      let p: MMPattern
      let rest: Pattern | null
      let changed = false
      while (
        typeof (p = pattern.pattern()) === 'string' &&
        (rest = pattern.rest())
      ) {
        t = t.resolve(p)
        pattern = rest
        changed = true
      }
      rest = pattern.rest()
      if (changed) {
        if (this.hasWalked.hasWalked(t, pattern)) continue
        this.hasWalked.storeWalked(t, pattern)
      }

      // now we have either a final string, or a pattern starting with magic,
      // mounted on t.
      if (typeof p === 'string') {
        // must be final entry
        const ifDir = p === '..' || p === '' || p === '.'
        this.matches.add(t.resolve(p), absolute, ifDir)
        continue
      } else if (p === GLOBSTAR) {
        // if no rest, match and subwalk pattern
        // if rest, process rest and subwalk pattern
        this.subwalks.add(t, pattern)
        if (!rest) {
          this.matches.add(t, absolute, false)
        } else {
          if (!this.hasWalked.hasWalked(t, rest)) {
            processingSet.push([t, rest])
          }
        }
      } else if (p instanceof RegExp) {
        this.subwalks.add(t, pattern)
      }
    }

    return this
  }

  subwalkTargets(): Path[] {
    return this.subwalks.keys()
  }

  child() {
    return new Processor(this.hasWalked)
  }

  // return a new Processor containing the subwalks for each
  // child entry, and a set of matches, and
  // a hasWalked cache that's a copy of this one
  // then we're going to call
  filterEntries(parent: Path, entries: Path[]): Processor {
    const patterns = this.subwalks.get(parent)
    // put matches and entry walks into the results processor
    const results = this.child()
    for (const e of entries) {
      for (const pattern of patterns) {
        const absolute = pattern.isAbsolute()
        const p = pattern.pattern()
        const rest = pattern.rest()
        let doSub: Pattern | undefined = undefined
        if (p === GLOBSTAR) {
          if (e.name.startsWith('.')) continue
          if (!rest) {
            results.matches.add(e, absolute, false)
          }
          if (e.isDirectory()) {
            doSub = pattern
          }
        } else if (p instanceof RegExp) {
          if (!p.test(e.name)) continue
          if (!rest) {
            results.matches.add(e, absolute, false)
          } else {
            doSub = rest
          }
        } else {
          // should never happen?
          if (!e.isNamed(p)) continue
          if (!rest) {
            results.matches.add(e, absolute, false)
          } else {
            doSub = rest
          }
        }
        if (doSub) {
          results.subwalks.add(e, doSub)
        }
      }
    }
    return results
  }
}
