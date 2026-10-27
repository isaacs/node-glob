// synchronous utility for filtering entries and calculating subwalks

import { GLOBSTAR } from 'minimatch'
import type { Path } from 'path-scurry'
import type { MMMatcher, MMPattern, Pattern } from './pattern.js'
import type { GlobWalkerOpts } from './walker.js'

/**
 * A cache of which patterns have been processed for a given Path, in
 * this walk step and the steps that led to it.
 *
 * A step only adds to it before it makes the caches for the next
 * steps, so a copy can look up the chain of caches before it, in
 * place of copying their entries. A pattern for a path that a cache
 * up the chain has already seen is added to that cache's set, so that
 * the other steps that share it see it too. Paths are keyed by their
 * full path, because path-scurry can make a new Path object for the
 * same path once its cache of children is full.
 */
export class HasWalkedCache {
  parent?: HasWalkedCache
  store?: Map<string, Set<string>>
  constructor(parent?: HasWalkedCache) {
    this.parent = parent
  }
  copy() {
    return new HasWalkedCache(this)
  }
  // the set for the path in this cache, or the closest one before it
  #find(fullpath: string): Set<string> | undefined {
    const set = this.store?.get(fullpath)
    return set || !this.parent ? set : this.parent.#find(fullpath)
  }

  hasWalked(target: Path, pattern: Pattern) {
    return !!this.#find(target.fullpath())?.has(pattern.globString())
  }
  storeWalked(target: Path, pattern: Pattern) {
    const fullpath = target.fullpath()
    const cached = this.#find(fullpath)
    if (cached) cached.add(pattern.globString())
    else
      (this.store ??= new Map()).set(
        fullpath,
        new Set([pattern.globString()]),
      )
  }
}

/**
 * A record of which paths have been matched in a given walk step,
 * and whether they only are considered a match if they are a directory,
 * and whether their absolute or relative path should be returned.
 * The store maps each path to {@link MatchRecord.ABSOLUTE} and
 * {@link MatchRecord.IF_DIR} flags.
 */
export class MatchRecord {
  static readonly ABSOLUTE = 2
  static readonly IF_DIR = 1
  store: Map<Path, number> = new Map()
  add(target: Path, absolute: boolean, ifDir: boolean) {
    const n =
      (absolute ? MatchRecord.ABSOLUTE : 0) |
      (ifDir ? MatchRecord.IF_DIR : 0)
    const current = this.store.get(target)
    this.store.set(target, current === undefined ? n : n & current)
  }
}

/**
 * A collection of patterns that must be processed in a subsequent step
 * for a given path.
 */
export class SubWalks {
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
    const subs = this.store.get(target)
    /* c8 ignore start */
    if (!subs) {
      throw new Error('attempting to walk unknown path')
    }
    /* c8 ignore stop */
    return subs
  }
  entries(): [Path, Pattern[]][] {
    return this.keys().map(k => [k, this.store.get(k) as Pattern[]])
  }
  keys(): Path[] {
    return [...this.store.keys()].filter(t => t.canReaddir())
  }
}

/**
 * The class that processes patterns for a given path.
 *
 * Handles child entry filtering, and determining whether a path's
 * directory contents must be read.
 */
export class Processor {
  hasWalkedCache: HasWalkedCache
  matches = new MatchRecord()
  subwalks = new SubWalks()
  patterns?: Pattern[]
  follow: boolean
  dot: boolean
  opts: GlobWalkerOpts

  constructor(opts: GlobWalkerOpts, hasWalkedCache?: HasWalkedCache) {
    this.opts = opts
    this.follow = !!opts.follow
    this.dot = !!opts.dot
    this.hasWalkedCache =
      hasWalkedCache ? hasWalkedCache.copy() : new HasWalkedCache()
  }

  processPatterns(target: Path, patterns: Pattern[]) {
    this.patterns = patterns
    const processingSet: [Path, Pattern][] = patterns.map(p => [target, p])

    // map of paths to the magic-starting subwalks they need to walk
    // first item in patterns is the filter

    for (let [t, pattern] of processingSet) {
      this.hasWalkedCache.storeWalked(t, pattern)

      const root = pattern.root()
      const absolute = pattern.isAbsolute() && this.opts.absolute !== false

      // start absolute patterns at root
      if (root) {
        t = t.resolve(
          root === '/' && this.opts.root !== undefined ?
            this.opts.root
          : root,
        )
        const rest = pattern.rest()
        if (!rest) {
          this.matches.add(t, true, false)
          continue
        } else {
          pattern = rest
        }
      }

      if (t.isENOENT()) continue

      let p: MMPattern
      let rest: Pattern | null
      let changed = false
      while (
        typeof (p = pattern.pattern()) === 'string' &&
        (rest = pattern.rest())
      ) {
        const c = t.resolve(p)
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

      // now we have either a final string for a known entry,
      // more strings for an unknown entry,
      // or a pattern starting with magic, mounted on t.
      if (typeof p === 'string') {
        // must not be final entry, otherwise we would have
        // concatenated it earlier.
        const ifDir = p === '..' || p === '' || p === '.'
        this.matches.add(t.resolve(p), absolute, ifDir)
        continue
      } else if (p === GLOBSTAR) {
        // if no rest, match and subwalk pattern
        // if rest, process rest and subwalk pattern
        // if it's a symlink, but we didn't get here by way of a
        // globstar match (meaning it's the first time THIS globstar
        // has traversed a symlink), then we follow it. Otherwise, stop.
        if (
          !t.isSymbolicLink() ||
          this.follow ||
          pattern.checkFollowGlobstar()
        ) {
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
            // this would mean you're matching **/.. at the fs root,
            // and no thanks, I'm not gonna test that specific case.
            /* c8 ignore start */
            const tp = t.parent || t
            /* c8 ignore stop */
            if (!rrest) this.matches.add(tp, absolute, true)
            else if (!this.hasWalkedCache.hasWalked(tp, rrest)) {
              this.subwalks.add(tp, rrest)
            }
          }
        }
      } else if (typeof p === 'object') {
        this.subwalks.add(t, pattern)
      }
    }

    return this
  }

  subwalkTargets(): Path[] {
    return this.subwalks.keys()
  }

  child() {
    return new Processor(this.opts, this.hasWalkedCache)
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
        } else if (typeof p === 'object') {
          results.testMatcher(e, p, rest, absolute)
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
    absolute: boolean,
  ) {
    if (this.dot || !e.name.startsWith('.')) {
      if (!pattern.hasMore()) {
        this.matches.add(e, absolute, false)
      }
      if (e.canReaddir()) {
        // if we're in follow mode or it's not a symlink, just keep
        // testing the same pattern. If there's more after the globstar,
        // then this symlink consumes the globstar. If not, then we can
        // follow at most ONE symlink along the way, so we mark it, which
        // also checks to ensure that it wasn't already marked.
        if (this.follow || !e.isSymbolicLink()) {
          this.subwalks.add(e, pattern)
        } else if (e.isSymbolicLink()) {
          if (rest && pattern.checkFollowGlobstar()) {
            this.subwalks.add(e, rest)
          } else if (pattern.markFollowGlobstar()) {
            this.subwalks.add(e, pattern)
          }
        }
      }
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
      } else if (rp === '..') {
        /* c8 ignore start */
        const ep = e.parent || e
        /* c8 ignore stop */
        this.subwalks.add(ep, rest)
      } else if (typeof rp === 'object') {
        this.testMatcher(e, rp, rest.rest(), absolute)
      }
    }
  }

  testMatcher(
    e: Path,
    p: MMMatcher,
    rest: Pattern | null,
    absolute: boolean,
  ) {
    // an entry name is one path portion, with no `/`
    if (!p.testUnchecked(e.name)) return
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
