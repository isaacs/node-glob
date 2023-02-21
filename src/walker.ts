// TODO: provide all the same iteration patterns that PathScurry has
// - [x] walk
// - [x] walkSync
// - [x] stream
// - [x] streamSync
// - [ ] iterator
// - [ ] iteratorSync

//  **/.. is really annoyingly slow, especially when repeated, because .. can't eliminate it.
//  but!  <pre>/**/../<rest> is equivalent to <pre>/../<name>/**/<rest> plus <pre>/.. or in other words:  <pre>/**/./<rest> plus <pre>/../<rest>
//  so <pre>/**/../*/**/../<rest> goes to: {<pre>/../*/**/../<rest>, <pre>/**/*/**/../<rest>}
//  which goes to: {<pre>/../*/**/../<rest>, <pre>/*/**/**/../<rest>}
//  {<pre>/../*/**/../<rest>, <pre>/*/**/../<rest>} then do the second **/..
//  {<pre>/../*/**/<rest>, <pre>/../*/../<rest>, <pre>/*/../<rest>, <pre>/*/**/<rest>}
//  {<pre>/../*/**/<rest>, <pre>/../<rest>, <pre>/<rest>, <pre>/*/**/<rest>}
//  reordering:
//   1                     2                  3                4
//  {<pre>/../*/**/<rest>, <pre>/*/**/<rest>, <pre>/../<rest>, <pre>/<rest>}
//
//  When we walk 1, that'll end up walking over each child in 2 with **, and
//  most of that pattern will be deduped out at some point, but we then can't
//  rely on the Pattern objects being unique, I guess?

// import LRUCache from 'lru-cache'
import { GLOBSTAR } from 'minimatch'
import Minipass from 'minipass'
import { Path } from 'path-scurry'

// a single minimatch set entry with 1 or more parts
import { MMPattern, Pattern } from './pattern.js'
import { Processor } from './processor.js'

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

// bitflag of <absolute, matchifdir>
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
    const subs = this.store.get(target)
    if (subs) subs.push(pattern)
    else this.store.set(target, [pattern])
  }
  entries() {
    return this.store.entries()
  }
}

export interface GlobWalkerOpts {
  absolute?: boolean
  realpath?: boolean
  nodir?: boolean
  mark?: boolean
  withFileTypes?: boolean
}
export type GWOFileTypesTrue = GlobWalkerOpts & {
  withFileTypes: true
}
export type GWOFileTypesFalse = GlobWalkerOpts & {
  withFileTypes: false
}
export type GWOFileTypesUnset = GlobWalkerOpts & {
  withFileTypes?: undefined
}

export type Result<O extends GlobWalkerOpts> = O extends GWOFileTypesTrue
  ? Path
  : O extends GWOFileTypesFalse
  ? string
  : O extends GWOFileTypesUnset
  ? string
  : Path | string

export type Matches<O extends GlobWalkerOpts> = O extends GWOFileTypesTrue
  ? Set<Path>
  : O extends GWOFileTypesFalse
  ? Set<string>
  : O extends GWOFileTypesUnset
  ? Set<string>
  : Set<Path | string>

export type MatchStream<O extends GlobWalkerOpts> =
  O extends GWOFileTypesTrue
    ? Minipass<Path>
    : O extends GWOFileTypesFalse
    ? Minipass<string>
    : O extends GWOFileTypesUnset
    ? Minipass<string>
    : Minipass<Path | string>

/**
 * basic walking utilities that all the glob walker types use
 */
export abstract class GlobUtil<O extends GlobWalkerOpts = GlobWalkerOpts> {
  path: Path
  patterns: Pattern[]
  opts: O
  seen: Set<Path> = new Set()
  paused: boolean = false
  #onResume: (() => any)[] = []

  constructor(patterns: Pattern[], path: Path, opts: O)
  constructor(patterns: Pattern[], path: Path, opts: O) {
    this.patterns = patterns
    this.path = path
    this.opts = opts
  }

  // backpressure mechanism
  pause() {
    this.paused = true
  }
  resume() {
    this.paused = false
    const fns = this.#onResume.slice()
    this.#onResume.length = 0
    for (const fn of fns) {
      fn()
    }
  }
  onResume(fn: () => any) {
    if (!this.paused) fn()
    else this.#onResume.push(fn)
  }

  // do the requisite realpath/stat checking, and return true/false
  // to say whether to include the match or filter it out.
  async matchCheck(e: Path, ifDir: boolean): Promise<Path | undefined> {
    let rpc: Path | undefined
    if (this.opts.realpath) {
      rpc = e.realpathCached()
      if (rpc) {
        if (this.seen.has(rpc) || (e.isDirectory() && this.opts.nodir)) {
          return undefined
        }
        e = rpc
      }
    }
    if (e.isDirectory() && this.opts.nodir) {
      return undefined
    }
    const needRealPath = !rpc && this.opts.realpath
    const needStat = e.isUnknown()
    if (needRealPath && needStat) {
      const r = await e.realpath().then(e => e?.lstat())
      if (
        !r ||
        this.seen.has(r) ||
        (!e.canReaddir() && ifDir) ||
        (e.isDirectory() && this.opts.nodir)
      ) {
        return undefined
      }
      return r
    } else if (needRealPath) {
      const r = await e.realpath()
      if (
        !r ||
        this.seen.has(r) ||
        (!e.canReaddir() && ifDir) ||
        (e.isDirectory() && this.opts.nodir)
      ) {
        return undefined
      }
      return r
    } else if (needStat) {
      const r = await e.lstat()
      if (
        !r ||
        this.seen.has(r) ||
        (!r.canReaddir() && ifDir) ||
        (r.isDirectory() && this.opts.nodir)
      ) {
        return undefined
      }
      return r
    } else if (
      this.seen.has(e) ||
      (!e.canReaddir() && ifDir) ||
      (e.isDirectory() && this.opts.nodir)
    ) {
      return undefined
    } else {
      return e
    }
  }

  matchCheckSync(e: Path, ifDir: boolean): Path | undefined {
    let rpc: Path | undefined
    if (this.opts.realpath) {
      rpc = e.realpathCached()
      if (rpc) {
        if (this.seen.has(rpc) || (e.isDirectory() && this.opts.nodir)) {
          return undefined
        }
        e = rpc
      }
    }
    if (e.isDirectory() && this.opts.nodir) {
      return undefined
    }
    const needRealPath = !rpc && this.opts.realpath
    const needStat = e.isUnknown()
    if (needRealPath && needStat) {
      const r = e.realpathSync()?.lstatSync()
      if (
        !r ||
        this.seen.has(r) ||
        (!r.canReaddir() && ifDir) ||
        (e.isDirectory() && this.opts.nodir)
      ) {
        return undefined
      }
      return r
    } else if (needRealPath) {
      const r = e.realpathSync()
      if (
        !r ||
        this.seen.has(r) ||
        (!r.canReaddir() && ifDir) ||
        (e.isDirectory() && this.opts.nodir)
      ) {
        return undefined
      }
      return r
    } else if (needStat) {
      const r = e.lstatSync()
      if (
        !r ||
        this.seen.has(r) ||
        (!r.canReaddir() && ifDir) ||
        (r.isDirectory() && this.opts.nodir)
      ) {
        return undefined
      }
      return r
    } else if (
      this.seen.has(e) ||
      (!e.canReaddir() && ifDir) ||
      (e.isDirectory() && this.opts.nodir)
    ) {
      return undefined
    } else {
      return e
    }
  }

  abstract matchEmit(p: Result<O>): void
  abstract matchEmit(p: string | Path): void

  matchFinish(e: Path, absolute: boolean) {
    if (this.seen.has(e)) return
    this.seen.add(e)
    const mark = this.opts.mark && e.isDirectory() ? '/' : ''
    // ok, we have what we need!
    if (this.opts.withFileTypes) {
      this.matchEmit(e)
    } else if (this.opts.nodir && e.isDirectory()) {
      return
    } else if (this.opts.absolute || absolute) {
      this.matchEmit(e.fullpath() + mark)
    } else {
      this.matchEmit(e.relative() + mark)
    }
  }

  async match(e: Path, absolute: boolean, ifDir: boolean): Promise<void> {
    const p = await this.matchCheck(e, ifDir)
    if (p) this.matchFinish(p, absolute)
  }

  matchSync(e: Path, absolute: boolean, ifDir: boolean): void {
    const p = this.matchCheckSync(e, ifDir)
    if (p) this.matchFinish(p, absolute)
  }

  // TODO: this function is the hottest path here,
  // need to optimize this.  Using a double-Map might
  // not be the best idea. Maybe could get away with 2 arrays?
  processPatterns(
    target: Path,
    patterns: Pattern[]
  ): [SubWalks, MatchRecord] {
    const processingSet: [Path, Pattern][] = patterns.map(p => [target, p])

    const hasWalkedCache = new HasWalkedCache()

    // found matches, path => [absolute, ifdir]
    const matches = new MatchRecord()

    // map of paths to the magic-starting subwalks they need to walk
    // first item in patterns is the filter
    const subwalks = new SubWalks()

    for (let [t, pattern] of processingSet) {
      if (hasWalkedCache.hasWalked(t, pattern)) continue
      hasWalkedCache.storeWalked(t, pattern)

      const root = pattern.root()
      const absolute = pattern.isAbsolute()

      // start absolute patterns at root
      if (root) {
        t = t.resolve(root)
        const rest = pattern.rest()
        if (!rest) {
          matches.add(t, true, false)
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
        if (hasWalkedCache.hasWalked(t, pattern)) continue
        hasWalkedCache.storeWalked(t, pattern)
      }

      // now we have either a final string, or a pattern starting with magic,
      // mounted on t.
      if (typeof p === 'string') {
        // must be final entry
        const ifDir = p === '..' || p === '' || p === '.'
        matches.add(t.resolve(p), absolute, ifDir)
        continue
      } else if (p === GLOBSTAR) {
        // if no rest, match and subwalk pattern
        // if rest, process rest and subwalk pattern
        subwalks.add(t, pattern)
        if (!rest) {
          matches.add(t, absolute, false)
        } else {
          if (!hasWalkedCache.hasWalked(t, rest)) {
            processingSet.push([t, rest])
          }
        }
      } else if (p instanceof RegExp) {
        subwalks.add(t, pattern)
      }
    }
    return [subwalks, matches]
  }

  walkCB(target: Path, patterns: Pattern[], cb: () => any) {
    if (this.paused) {
      this.onResume(() => this.walkCB(target, patterns, cb))
      return
    }
    this.walkCB2(target, patterns, new Processor(), cb)
  }

  walkCB2(
    target: Path,
    patterns: Pattern[],
    processor: Processor,
    cb: () => any
  ) {
    if (this.paused) {
      this.onResume(() => this.walkCB2(target, patterns, processor, cb))
      return
    }
    processor.processPatterns(target, patterns)

    // done processing.  all of the above is sync, can be abstracted out.
    // subwalks is a map of paths to the entry filters they need
    // matches is a map of paths to [absolute, ifDir] tuples.
    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.seen.has(m)) continue
      tasks++
      this.match(m, absolute, ifDir).then(() => next())
    }

    for (const t of processor.subwalkTargets()) {
      tasks++
      const childrenCached = t.readdirCached()
      if (t.calledReaddir())
        this.walkCB3(t, childrenCached, processor, next)
      else {
        t.readdirCB(
          (_, entries) => this.walkCB3(t, entries, processor, next),
          true
        )
      }
    }

    next()
  }

  walkCB3(
    target: Path,
    entries: Path[],
    processor: Processor,
    cb: () => any
  ) {
    processor = processor.filterEntries(target, entries)

    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.seen.has(m)) continue
      tasks++
      this.match(m, absolute, ifDir).then(() => next())
    }
    for (const [target, patterns] of processor.subwalks.entries()) {
      tasks++
      this.walkCB2(target, patterns, processor.child(), next)
    }

    next()
  }

  walkCBSync(target: Path, patterns: Pattern[], cb: () => any) {
    if (this.paused) {
      this.onResume(() => this.walkCBSync(target, patterns, cb))
      return
    }
    this.walkCB2Sync(target, patterns, new Processor(), cb)
  }

  walkCB2Sync(
    target: Path,
    patterns: Pattern[],
    processor: Processor,
    cb: () => any
  ) {
    if (this.paused) {
      this.onResume(() =>
        this.walkCB2Sync(target, patterns, processor, cb)
      )
      return
    }
    processor.processPatterns(target, patterns)

    // done processing.  all of the above is sync, can be abstracted out.
    // subwalks is a map of paths to the entry filters they need
    // matches is a map of paths to [absolute, ifDir] tuples.
    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.seen.has(m)) continue
      this.matchSync(m, absolute, ifDir)
    }

    for (const t of processor.subwalkTargets()) {
      tasks++
      const children = t.readdirSync()
      this.walkCB3Sync(t, children, processor, next)
    }

    next()
  }

  walkCB3Sync(
    target: Path,
    entries: Path[],
    processor: Processor,
    cb: () => any
  ) {
    processor = processor.filterEntries(target, entries)

    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.seen.has(m)) continue
      this.matchSync(m, absolute, ifDir)
    }
    for (const [target, patterns] of processor.subwalks.entries()) {
      tasks++
      this.walkCB2Sync(target, patterns, processor.child(), next)
    }

    next()
  }
}

export class GlobWalker<
  O extends GlobWalkerOpts = GlobWalkerOpts
> extends GlobUtil<O> {
  matches: O extends GWOFileTypesTrue
    ? Set<Path>
    : O extends GWOFileTypesFalse
    ? Set<string>
    : O extends GWOFileTypesUnset
    ? Set<string>
    : Set<Path | string>

  constructor(patterns: Pattern[], path: Path, opts: O) {
    super(patterns, path, opts)
    this.matches = new Set() as Matches<O>
  }

  matchEmit(e: Result<O>): void
  matchEmit(e: Path | string): void {
    this.matches.add(e)
  }

  async walk(): Promise<Matches<O>> {
    const t = this.path.isUnknown() ? await this.path.lstat() : this.path
    if (t) {
      await new Promise(res => {
        this.walkCB(t, this.patterns, () => res(this.matches))
      })
    }
    return this.matches
  }

  walkSync(): Matches<O> {
    const t = this.path.isUnknown() ? this.path.lstatSync() : this.path
    // nothing for the callback to do, because this never pauses
    if (t) this.walkCBSync(t, this.patterns, () => {})
    return this.matches
  }
}

export class GlobStream<
  O extends GlobWalkerOpts = GlobWalkerOpts
> extends GlobUtil<O> {
  results: O extends GWOFileTypesTrue
    ? Minipass<Path>
    : O extends GWOFileTypesFalse
    ? Minipass<string>
    : O extends GWOFileTypesUnset
    ? Minipass<string>
    : Minipass<Path | string>

  constructor(patterns: Pattern[], path: Path, opts: O) {
    super(patterns, path, opts)
    this.results = new Minipass({ objectMode: true }) as MatchStream<O>
    this.results.on('drain', () => this.resume())
    this.results.on('resume', () => this.resume())
  }

  matchEmit(e: Result<O>): void
  matchEmit(e: Path | string): void {
    if (e === '') e = '.'
    if (!this.results.write(e)) this.pause()
  }

  stream(): MatchStream<O> {
    const target = this.path
    if (target.isUnknown()) {
      target.lstat().then(e => {
        if (e) {
          this.walkCB(target, this.patterns, () => this.results.end())
        } else {
          this.results.end()
        }
      })
    } else {
      this.walkCB(target, this.patterns, () => this.results.end())
    }
    return this.results
  }

  streamSync(): MatchStream<O> {
    const target = this.path.isUnknown()
      ? this.path.lstatSync()
      : this.path
    if (target) {
      this.walkCBSync(target, this.patterns, () => this.results.end())
    }
    return this.results
  }
}
