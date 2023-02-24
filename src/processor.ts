// synchronous utility for filtering entries and calculating subwalks

import { GLOBSTAR, MMRegExp } from 'minimatch'
import { Path } from 'path-scurry'
import { MMPattern, Pattern } from './pattern.js'

class HasWalkedCache {
  store: Map<string, Set<string>>
  constructor(store: Map<string, Set<string>> = new Map()) {
    this.store = store
  }
  copy() {
    return new HasWalkedCache(new Map(this.store))
  }
  hasWalked(target: Path, pattern: Pattern) {
    return this.store.get(target.fullpath())?.has(pattern.globString())
  }
  storeWalked(target: Path, pattern: Pattern) {
    const fullpath = target.fullpath()
    const cached = this.store.get(fullpath)
    if (cached) cached.add(pattern.globString())
    else this.store.set(fullpath, new Set([pattern.globString()]))
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
  add(target: Path, pattern: Pattern) {
    if (!target.canReaddir()) {
      return
    }
    const subs = this.store.get(target)
    if (subs) {
      if (!subs.find(p => p.globString() === pattern.globString())) {
        subs.push(pattern)
      }
    } else this.store.set(target, [pattern])
  }
  get(target: Path): Pattern[] {
    return this.store.get(target) || []
  }
  entries(): [Path, Pattern[]][] {
    return this.keys().map(k => [k, this.store.get(k) as Pattern[]])
  }
  keys(): Path[] {
    return [...this.store.keys()].filter(t => t.canReaddir())
  }
}

export class Processor {
  hasWalkedCache: HasWalkedCache
  matches = new MatchRecord()
  subwalks = new SubWalks()
  patterns?: Pattern[]

  constructor(hasWalkedCache?: HasWalkedCache) {
    this.hasWalkedCache = hasWalkedCache
      ? hasWalkedCache.copy()
      : new HasWalkedCache()
  }

  processPatterns(target: Path, patterns: Pattern[]) {
    this.patterns = patterns
    const processingSet: [Path, Pattern][] = patterns.map(p => [target, p])

    // map of paths to the magic-starting subwalks they need to walk
    // first item in patterns is the filter

    for (let [t, pattern] of processingSet) {
      if (this.hasWalkedCache.hasWalked(t, pattern)) {
        continue
      }
      this.hasWalkedCache.storeWalked(t, pattern)

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

      let p: MMPattern
      let rest: Pattern | null
      let changed = false
      while (
        typeof (p = pattern.pattern()) === 'string' &&
        (rest = pattern.rest())
      ) {
        const c = t.resolve(p)
        if (c.isUnknown()) break
        t = c
        pattern = rest
        changed = true
      }
      p = pattern.pattern()
      rest = pattern.rest()
      if (changed) {
        if (this.hasWalkedCache.hasWalked(t, pattern)) continue
        this.hasWalkedCache.storeWalked(t, pattern)
      }

      // now we have either a final string, or a pattern starting with magic,
      // mounted on t.
      if (typeof p === 'string') {
        // must be final entry
        if (!rest) {
          const ifDir = p === '..' || p === '' || p === '.'
          this.matches.add(t.resolve(p), absolute, ifDir)
        } else {
          this.subwalks.add(t, pattern)
        }
        continue
      } else if (p === GLOBSTAR) {
        // if no rest, match and subwalk pattern
        // if rest, process rest and subwalk pattern
        // if it's a symlink, but we didn't get here by way of a
        // globstar match (meaning it's the first time THIS globstar
        // has traversed a symlink), then we follow it. Otherwise, stop.
        if (!t.isSymbolicLink() || pattern.followGlobstar()) {
          this.subwalks.add(t, pattern)
        }
        const rp = rest?.pattern()
        const rrest = rest?.rest()
        if (!rest || ((rp === '' || rp === '.') && !rrest)) {
          // only HAS to be a dir if it ends in **/ or **/.
          // but ending in ** will match files as well.
          this.matches.add(t, absolute, rp === '' || rp === '.')
        } else {
          if (rp === '..') {
            const tp = t.parent || t
            if (!rrest) this.matches.add(tp, absolute, true)
            else if (!this.hasWalkedCache.hasWalked(tp, rrest)) {
              this.subwalks.add(tp, rrest)
            }
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
    return new Processor(this.hasWalkedCache)
  }

  // return a new Processor containing the subwalks for each
  // child entry, and a set of matches, and
  // a hasWalkedCache that's a copy of this one
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
        if (p === GLOBSTAR) {
          results.testGlobstar(e, pattern, rest, absolute)
        } else if (p instanceof RegExp) {
          results.testRegExp(e, p, rest, absolute)
        } else {
          results.testString(e, p, rest, absolute)
        }
      }
    }
    return results
  }

  testGlobstar(
    e: Path,
    pattern: Pattern,
    rest: Pattern | null,
    absolute: boolean
  ) {
    if (e.name.startsWith('.')) return
    if (!pattern.hasMore()) {
      this.matches.add(e, absolute, false)
    }
    // record that this globstar is following a symlink, so we
    // can know to stop traversing when we encounter it again
    // in processPatterns.
    if (e.isSymbolicLink()) {
      pattern.followGlobstar()
    }
    if (e.canReaddir()) {
      this.subwalks.add(e, pattern)
    }
    // if the NEXT thing matches this entry, then also add
    // the rest.
    if (rest) {
      const rp = rest.pattern()
      if (
        typeof rp === 'string' &&
        // dots and empty were handled already
        rp !== '..' &&
        rp !== '' &&
        rp !== '.'
      ) {
        this.testString(e, rp, rest.rest(), absolute)
      } else if (rp instanceof RegExp) {
        this.testRegExp(e, rp, rest.rest(), absolute)
      }
    }
  }

  testRegExp(
    e: Path,
    p: MMRegExp,
    rest: Pattern | null,
    absolute: boolean
  ) {
    if (!p.test(e.name)) return
    if (!rest) {
      this.matches.add(e, absolute, false)
    } else {
      this.subwalks.add(e, rest)
    }
  }

  testString(e: Path, p: string, rest: Pattern | null, absolute: boolean) {
    // should never happen?
    if (!e.isNamed(p)) return
    if (!rest) {
      this.matches.add(e, absolute, false)
    } else {
      this.subwalks.add(e, rest)
    }
  }
}
