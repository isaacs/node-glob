// TODO: provide all the same iteration patterns that PathScurry has
// - [x] walk
// - [x] walkSync
// - [ ] stream
// - [ ] streamSync
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

import LRUCache from 'lru-cache'
import { GLOBSTAR } from 'minimatch'
import Minipass from 'minipass'
import { Path } from 'path-scurry'

// a single minimatch set entry with 1 or more parts
import { MMPattern, Pattern } from './pattern.js'

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
  hasWalkedCache: LRUCache<Path, Pattern[]> = new LRUCache<
    Path,
    Pattern[]
  >({
    maxSize: 256,
    sizeCalculation: v => v.length + 1,
  })

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
    let fn: (() => any) | undefined = undefined
    while (!this.paused && (fn = this.#onResume.shift())) {
      fn()
      if (this.paused) break
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

  hasWalked(target: Path, pattern: Pattern): boolean {
    const cached = this.hasWalkedCache.get(target)
    return !!cached?.includes(pattern)
  }
  storeWalked(target: Path, pattern: Pattern) {
    const cached = this.hasWalkedCache.get(target)
    if (!cached) this.hasWalkedCache.set(target, [pattern])
    else if (!cached.includes(pattern)) cached.push(pattern)
  }

  processPatterns(
    target: Path,
    patterns: Pattern[]
  ): [Map<Path, Pattern[]>, Map<Path, [boolean, boolean]>] {
    const processingSet = new Set<[Path, Pattern]>(
      patterns
        .filter(p => !this.hasWalked(target, p))
        .map(p => [target, p])
    )

    // found matches, path => [absolute, ifdir]
    const matches = new Map<Path, [boolean, boolean]>()

    // map of paths to the magic-starting subwalks they need to walk
    // first item in patterns is the filter
    const subwalks = new Map<Path, Pattern[]>()

    for (let [t, pattern] of processingSet) {
      if (this.hasWalked(t, pattern)) continue
      this.storeWalked(t, pattern)

      // TODO: if (this.hasWalked(t, pattern)) continue
      // TODO: update hasWalked to add the pattern to the list
      // TODO: make hasWalked use an LRU
      const root = pattern.root()
      const absolute = pattern.isAbsolute()

      // start absolute patterns at root
      if (root) {
        t = t.resolve(root)
        const rest = pattern.rest()
        if (!rest) {
          matches.set(t, [true, false])
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
        if (this.hasWalked(t, pattern)) continue
        this.storeWalked(t, pattern)
      }

      // now we have either a final string, or a pattern starting with magic,
      // mounted on t.
      if (typeof p === 'string') {
        // must be final entry
        const ifDir = p === '..' || p === '' || p === '.'
        matches.set(t.resolve(p), [absolute, ifDir])
        continue
      } else if (p === GLOBSTAR) {
        // if no rest, match and subwalk pattern
        // if rest, process rest and subwalk pattern
        const subs = subwalks.get(t)
        if (!subs) {
          subwalks.set(t, [pattern])
        } else {
          subs.push(pattern)
        }
        if (!rest) {
          matches.set(t, [absolute, false])
        } else if (!this.hasWalked(t, rest)) {
          processingSet.add([t, rest])
        }
      } else if (p instanceof RegExp) {
        const subs = subwalks.get(t)
        if (!subs) {
          subwalks.set(t, [pattern])
        } else {
          subs.push(pattern)
        }
      }
    }
    return [subwalks, matches]
  }

  walkCB(target: Path, patterns: Pattern[], cb: () => any) {
    this.hasWalkedCache.clear()
    if (this.paused) {
      this.onResume(() => this.walkCB(target, patterns, cb))
      return
    }
    this.walkCB2(target, patterns, cb)
  }

  walkCB2(target: Path, patterns: Pattern[], cb: () => any) {
    if (this.paused) {
      this.onResume(() => this.walkCB2(target, patterns, cb))
      return
    }
    const [subwalks, matches] = this.processPatterns(target, patterns)

    // done processing.  all of the above is sync, can be abstracted out.
    // subwalks is a map of paths to the entry filters they need
    // matches is a map of paths to [absolute, ifDir] tuples.
    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, [absolute, ifDir]] of matches.entries()) {
      tasks++
      this.match(m, absolute, ifDir).then(() => next())
    }

    for (const [t, patterns] of subwalks.entries()) {
      // if we can't read it, no sense trying
      if (!t.canReaddir()) continue
      // if they're all globstar, and it's a symlink, skip it.
      if (
        t.isSymbolicLink() &&
        !patterns.some(p => p.pattern() instanceof RegExp)
      ) {
        continue
      }

      tasks++
      const childrenCached = t.readdirCached()
      if (t.calledReaddir()) this.walkCB3(childrenCached, patterns, next)
      else {
        t.readdirCB(
          (_, entries) => this.walkCB3(entries, patterns, next),
          true
        )
      }
    }

    next()
  }

  filterEntries(
    entries: Path[],
    patterns: Pattern[]
  ): [Map<Path, Pattern[]>, Map<Path, [boolean, boolean]>] {
    const subwalks = new Map<Path, Pattern[]>()
    const matches = new Map<Path, [boolean, boolean]>()
    for (const e of entries) {
      for (const pattern of patterns) {
        const absolute = pattern.isAbsolute()
        const p = pattern.pattern()
        const rest = pattern.rest()
        let doSub: Pattern | undefined = undefined
        if (p === GLOBSTAR) {
          if (e.name.startsWith('.')) continue
          if (!rest) {
            matches.set(e, [absolute, false])
          } else if (e.isDirectory()) {
            doSub = pattern
          }
        } else if (p instanceof RegExp) {
          if (!p.test(e.name)) continue
          if (!rest) {
            matches.set(e, [absolute, false])
          } else {
            doSub = rest
          }
        } else {
          // should never happen?
          if (!e.isNamed(p)) continue
          if (!rest) {
            matches.set(e, [absolute, false])
          } else {
            doSub = rest
          }
        }
        if (doSub && !this.hasWalked(e, doSub)) {
          const subs = subwalks.get(e)
          if (!subs) {
            subwalks.set(e, [doSub])
          } else {
            subs.push(doSub)
          }
        }
      }
    }
    return [subwalks, matches]
  }

  walkCB3(entries: Path[], patterns: Pattern[], cb: () => any) {
    const [subwalks, matches] = this.filterEntries(entries, patterns)

    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, [absolute, ifDir]] of matches.entries()) {
      tasks++
      this.match(m, absolute, ifDir).then(() => next())
    }
    for (const [target, patterns] of subwalks.entries()) {
      tasks++
      this.walkCB2(target, patterns, next)
    }

    next()
  }

  walkCBSync(target: Path, patterns: Pattern[], cb: () => any) {
    if (this.paused) {
      this.onResume(() => this.walkCBSync(target, patterns, cb))
      return
    }
    if (target.isUnknown()) {
      target.lstat().then(t => {
        if (!t) cb()
        else this.walkCB2Sync(t, patterns, cb)
      })
    } else {
      this.walkCB2Sync(target, patterns, cb)
    }
  }

  walkCB2Sync(target: Path, patterns: Pattern[], cb: () => any) {
    if (this.paused) {
      this.onResume(() => this.walkCB2(target, patterns, cb))
      return
    }
    const [subwalks, matches] = this.processPatterns(target, patterns)

    // done processing.  all of the above is sync, can be abstracted out.
    // subwalks is a map of paths to the entry filters they need
    // matches is a map of paths to [absolute, ifDir] tuples.
    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, [absolute, ifDir]] of matches.entries()) {
      tasks++
      this.matchSync(m, absolute, ifDir)
    }

    for (const [t, patterns] of subwalks.entries()) {
      // if we can't read it, no sense trying
      if (!t.canReaddir()) continue
      // if they're all globstar, and it's a symlink, skip it.
      if (
        t.isSymbolicLink() &&
        !patterns.some(p => p.pattern() instanceof RegExp)
      ) {
        continue
      }

      tasks++
      const childrenCached = t.readdirCached()
      if (t.calledReaddir())
        this.walkCB3Sync(childrenCached, patterns, next)
      else this.walkCB3Sync(t.readdirSync(), patterns, next)
    }

    next()
  }

  walkCB3Sync(entries: Path[], patterns: Pattern[], cb: () => any) {
    const [subwalks, matches] = this.filterEntries(entries, patterns)

    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, [absolute, ifDir]] of matches.entries()) {
      tasks++
      this.matchSync(m, absolute, ifDir)
    }
    for (const [target, patterns] of subwalks.entries()) {
      tasks++
      this.walkCB2Sync(target, patterns, next)
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
  }

  matchEmit(e: Result<O>): void
  matchEmit(e: Path | string): void {
    if (!this.results.write(e)) {
      this.pause()
    }
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
