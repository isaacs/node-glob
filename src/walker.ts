// TODO: ok, new algorithm for this is needed, clearly
// forking out GlobWalkers for the set of children is just no good.
// When not the last piece of the pattern:
// if the pattern is a ** or regexp, we need to build a set of children
// paths that need to be walked once the piece is consumed.
//
// For **, this is a Scurry walk of all directories under the path
// For regexp, this is the children that match the regexp
//
// Then we iterate over that set, creating a new set of each child path
// that matches the next part of the pattern, and so on.
//
// At the end, we have the set of all the child paths that matched up to
// the last part of the pattern.
//
// If the last part is:
// '', ensure they're all directories, and return
// string, then .child it and maybe lstat
// **, scurry walk for all entries, only walking directories
// regexp, readdir and filter

import { Path } from 'path-scurry'

// a single minimatch set entry with 1 or more parts
import { Pattern } from './pattern.js'

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

// the "matches" set is a set of either:
// - Path objects (if withFileTypes:true)
// - resolved paths (if absolute:true)
// - real paths (if realpath:true)
// - built-up path strings (all other cases)

// get the Path objects that match the pattern
export class GlobWalker<O extends GlobWalkerOpts = GlobWalkerOpts> {
  path: Path
  pattern: Pattern
  matches: O extends GWOFileTypesTrue
    ? Set<Path>
    : O extends GWOFileTypesFalse
    ? Set<string>
    : O extends GWOFileTypesUnset
    ? Set<string>
    : Set<Path | string>
  opts: O
  seen: Set<Path>

  constructor(
    pattern: Pattern,
    path: Path,
    matches: Matches<O> | undefined,
    seen: Set<Path> | undefined,
    opts: O
  )
  constructor(
    pattern: Pattern,
    path: Path,
    matches: Matches<O> | undefined,
    seen: Set<Path> | undefined,
    opts: O
  ) {
    this.pattern = pattern
    this.path = path
    this.matches = (matches || new Set()) as Matches<O>
    this.opts = opts
    this.seen = seen || new Set()
  }

  // do the requisite realpath/stat checking, and return true/false
  // to say whether to include the match or filter it out.
  async matchPrecheck(e: Path): Promise<Path | undefined> {
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
    const needRealPath = this.opts.realpath && !rpc
    const needStat = (this.opts.nodir || this.opts.mark) && e.isUnknown()
    if (needRealPath && needStat) {
      const r = await e.realpath().then(e => e && e.lstat())
      if (!r || this.seen.has(r) || (e.isDirectory() && this.opts.nodir)) {
        return undefined
      }
      return r
    } else if (needRealPath) {
      const r = await e.realpath()
      if (!r || this.seen.has(r) || (e.isDirectory() && this.opts.nodir)) {
        return undefined
      }
      return r
    } else if (needStat) {
      return await e.lstat()
    }
    return e
  }

  matchPrecheckSync(e: Path): Path | undefined {
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
    const needRealPath = this.opts.realpath && !rpc
    const needStat = (this.opts.nodir || this.opts.mark) && e.isUnknown()
    if (needRealPath && needStat) {
      const r = e.realpathSync()?.lstatSync()
      if (!r || this.seen.has(r) || (e.isDirectory() && this.opts.nodir)) {
        return undefined
      }
      return r
    } else if (needRealPath) {
      const r = e.realpathSync()
      if (!r || this.seen.has(r) || (e.isDirectory() && this.opts.nodir)) {
        return undefined
      }
      return r
    } else if (needStat) {
      return e.lstatSync()
    }
    return e
  }

  matchFinal(e: Path) {
    this.seen.add(e)
    const mark = this.opts.mark && e.isDirectory() ? '/' : ''
    // ok, we have what we need!
    if (this.opts.withFileTypes) {
      this.matches.add(e)
    } else if (this.opts.nodir && e.isDirectory()) {
      return
    } else if (this.opts.absolute) {
      this.matches.add(e.fullpath() + mark)
    } else {
      this.matches.add(e.relative() + mark)
    }
  }

  async match(e: Path): Promise<void> {
    const p = await this.matchPrecheck(e)
    if (p) this.matchFinal(p)
  }

  matchSync(e: Path): void {
    const p = this.matchPrecheckSync(e)
    if (p) this.matchFinal(p)
  }

  // used to gather children to walk when ** appears mid-pattern
  // pattern here is everything AFTER the **
  async walkGlobStarDirs(
    path: Path,
    pattern: Pattern
  ): Promise<Matches<O>> {
    //     return new Promise<Matches<O>>(res => {
    //       this.walkGlobStarDirsEntriesCB([path], pattern, () =>
    //         res(this.matches)
    //       )
    //     })
    if (
      !(path.isDirectory() || path.isUnknown()) ||
      path.name.startsWith('.')
    ) {
      return this.matches
    }
    await this.match(path)
    const entriesCached = path.readdirCached()
    const entries = path.calledReaddir()
      ? entriesCached
      : await path.readdir()
    if (!entries.length) return this.matches
    const promises: Promise<any>[] = []
    // collect all matches from this dir the rest of the pattern
    await this.walk(path, pattern)
    for (const e of entries) {
      if (!(e.isDirectory() || e.isUnknown()) || e.name.startsWith('.')) {
        continue
      }
      promises.push(this.walkGlobStarDirs(e, pattern))
    }
    if (promises.length) await Promise.all(promises)
    return this.matches
  }

  walkGlobStarDirsSync(path: Path, pattern: Pattern): Matches<O> {
    if (
      !(path.isDirectory() || path.isUnknown()) ||
      path.name.startsWith('.')
    ) {
      return this.matches
    }
    this.matchSync(path)
    const entries = path.readdirSync()
    if (!entries.length) return this.matches
    this.walkSync(path, pattern)
    for (const e of entries) {
      if (!(e.isDirectory() || e.isUnknown()) || e.name.startsWith('.'))
        continue
      this.walkGlobStarDirsSync(e, pattern)
    }
    return this.matches
  }

  // used when the last item in the pattern is **
  async walkGlobStarAll(path: Path): Promise<Matches<O>> {
    if (path.name.startsWith('.')) {
      return this.matches
    }
    await this.match(path)
    if (!path.isDirectory()) return this.matches
    const entriesCached = path.readdirCached()
    const entries = path.calledReaddir()
      ? entriesCached
      : await path.readdir()
    if (!entries.length) return this.matches
    const promises: Promise<any>[] = []
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      promises.push(this.match(e))
      if (e.isDirectory()) promises.push(this.walkGlobStarAll(e))
    }
    if (promises.length) await Promise.all(promises)
    return this.matches
  }

  walkGlobStarAllSync(path: Path): Matches<O> {
    if (path.name.startsWith('.')) {
      return this.matches
    }
    this.matchSync(path)
    if (!path.isDirectory()) return this.matches
    const entries = path.readdirSync()
    if (!entries.length) return this.matches
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      this.matchSync(e)
      if (e.isDirectory()) this.walkGlobStarAllSync(e)
    }
    return this.matches
  }

  async walk(
    target: Path = this.path,
    pattern: Pattern = this.pattern
  ): Promise<Matches<O>> {
    // each step, we get the set of all items that match
    // the current piece of the pattern, and recurse if there's
    // pattern left.
    // have more pattern:
    // **: do a globStarDirs walk, attach rest to all found, return
    // string: path.child(), walk rest of the pattern
    // regexp: filter children, walk rest on all of them
    // last pattern:
    // **: if path is a dir, add to matches, along with all descendants
    // string: if path exists, add to matches
    // regexp: filter children, all are matches

    const p = pattern.pattern()
    const rest = pattern.rest()
    if (rest) {
      if (!target.canReaddir()) return this.matches
      if (typeof p === 'string') {
        return this.walk(target.child(p), rest)
      } else if (p instanceof RegExp) {
        return this.walkRegExp(target, pattern)
      } else {
        // globstar
        return this.walkGlobStar(target, pattern)
      }
    } else {
      if (p === '') {
        //matches only if path is a dir
        if (target.isUnknown()) await target.lstat()
        if (target.isDirectory()) await this.match(target)
        return this.matches
      } else if (typeof p === 'string') {
        // last item! will stat etc if needed.
        const e = target.isUnknown() ? await target.lstat() : target
        if (e) await this.match(e)
        return this.matches
      } else if (p instanceof RegExp) {
        return this.walkRegExp(target, pattern)
      } else {
        return this.walkGlobStar(target, pattern)
      }
    }
  }

  walkSync(
    target: Path = this.path,
    pattern: Pattern = this.pattern
  ): Matches<O> {
    const p = pattern.pattern()
    const rest = pattern.rest()
    if (rest) {
      if (!target.canReaddir()) return this.matches
      if (typeof p === 'string') {
        return this.walkSync(target.child(p), rest)
      } else if (p instanceof RegExp) {
        return this.walkRegExpSync(target, pattern)
      } else {
        // globstar
        return this.walkGlobStarSync(target, pattern)
      }
    } else {
      if (p === '') {
        //matches only if path is a dir
        if (target.isUnknown()) target.lstatSync()
        if (target.isDirectory()) this.matchSync(target)
        return this.matches
      } else if (typeof p === 'string') {
        // last item! will stat etc if needed.
        const e = target.isUnknown() ? target.lstatSync() : target
        if (e) this.matchSync(e)
        return this.matches
      } else if (p instanceof RegExp) {
        return this.walkRegExpSync(target, pattern)
      } else {
        return this.walkGlobStarSync(target, pattern)
      }
    }
  }

  async maybeMatchPath(): Promise<void> {
    if (this.path.isUnknown()) {
      const lsc = this.path.lstatCached()
      if (lsc) {
        return this.match(lsc)
      } else {
        return this.path.lstat().then(p => p && this.match(p))
      }
    } else {
      return this.match(this.path)
    }
  }
  maybeMatchPathSync() {
    if (this.path.isUnknown()) {
      const lsc = this.path.lstatCached()
      if (lsc) {
        this.matchSync(lsc)
      } else {
        const p = this.path.lstatSync()
        if (p) this.matchSync(p)
      }
    } else {
      this.matchSync(this.path)
    }
  }

  // note: we do not need to add the current path as a match here,
  // ONLY process children.  The current path will be added in the walk
  // method itself.
  async walkGlobStar(path: Path, pattern: Pattern): Promise<Matches<O>> {
    // get all children, and walk from there
    if (!path.canReaddir()) {
      return this.matches
    }
    const rest = pattern.rest()
    return rest
      ? this.walkGlobStarDirs(path, rest)
      : this.walkGlobStarAll(path)
  }

  walkGlobStarSync(path: Path, pattern: Pattern): Matches<O> {
    // get all children, and walk from there
    if (!path.canReaddir()) {
      return this.matches
    }
    const rest = pattern.rest()
    return rest
      ? this.walkGlobStarDirsSync(path, rest)
      : this.walkGlobStarAllSync(path)
  }

  // kind of like walkGlobStar, but without the recursion, just one level
  // and attach the rest of the pattern to it, or call it a match
  async walkRegExp(path: Path, pattern: Pattern): Promise<Matches<O>> {
    if (!path.canReaddir()) {
      return this.matches
    }
    const p = pattern.pattern() as RegExp
    const rest = pattern.rest()
    const promises: Promise<any>[] = []
    const entries = path.calledReaddir()
      ? path.readdirCached()
      : await path.readdir()
    for (const e of entries) {
      if (!p.test(e.name)) continue
      if (rest) {
        if (!e.canReaddir()) continue
        promises.push(this.walk(e, rest))
      } else {
        promises.push(this.match(e))
      }
    }
    if (promises.length) await Promise.all(promises)
    return this.matches
    // if (!path.canReaddir()) {
    //   return this.matches
    // }
    // const p = pattern.pattern() as RegExp
    // const rest = pattern.rest()
    // return new Promise<Matches<O>>(res => {
    //   const cb = () => res(this.matches)
    //   path.readdirCB((_, entries) => {
    //     if (!entries.length) return cb()
    //     let len = 1
    //     for (const e of entries) {
    //       if (!p.test(e.name)) continue
    //       if (rest) {
    //         if (!e.canReaddir()) continue
    //         len++
    //         this.walk(e, rest).then(() => {
    //           if (--len === 0) cb()
    //         })
    //       } else {
    //         len++
    //         this.match(e).then(() => {
    //           if (--len === 0) cb()
    //         })
    //       }
    //     }
    //     if (--len === 0) cb()
    //   }, true)
    // })
  }

  walkRegExpSync(path: Path, pattern: Pattern): Matches<O> {
    if (!path.canReaddir()) {
      return this.matches
    }
    const p = pattern.pattern() as RegExp
    const rest = pattern.rest()
    for (const e of path.readdirSync()) {
      if (!p.test(e.name)) continue
      if (rest) {
        if (!e.canReaddir()) continue
        this.walkSync(e, rest)
      } else {
        this.matchSync(e)
      }
    }
    return this.matches
  }
}
