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

  matchFinal(e: Path) {
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

  matchSync(e: Path) {
    if (this.opts.realpath) {
      const r = e.realpathSync()
      if (!r) return
      e = r
    }
    if (e.isUnknown() && (this.opts.nodir || this.opts.mark)) {
      const ls = e.lstatSync()
      if (!ls) return
    }
    if (this.opts.nodir && e.isDirectory()) {
      return
    }
    const mark = this.opts.mark && e.isDirectory() ? '/' : ''
    // ok, we have what we need!
    if (this.opts.withFileTypes) {
      this.matches.add(e)
    } else if (this.opts.absolute) {
      this.matches.add(e.fullpath() + mark)
    } else {
      this.matches.add(e.relative() + mark)
    }
  }

  async walk(): Promise<Matches<O>> {
    // consume all pattern portions except the last one.
    // if the last one is a string, then we stat and add it.
    while (this.pattern.hasMore()) {
      const p = this.pattern.pattern()
      if (typeof p === 'string') {
        this.pattern.shift()
        this.path = this.path.child(p)
      } else if (p instanceof RegExp) {
        // this fans out, but we must match the pattern against
        // something, so nothing else to do here.
        await this.walkRegExp(p, this.pattern)
        return this.matches
      } else {
        // globstar!
        // this fans out, but also continues without the **
        await this.walkGlobStar(this.pattern)
        this.pattern.shift()
      }
    }
    const p = this.pattern.pattern()
    if (typeof p === 'string') {
      this.path = this.path.child(p)
      await this.maybeMatchPath()
    } else if (p instanceof RegExp) {
      await this.walkRegExp(p, this.pattern)
    } else {
      // globstar at the end is either nothing, or all children
      // make sure our path actually exists, if it was something
      // like a/b/** we might've got here without checking
      await Promise.all([
        this.maybeMatchPath(),
        this.walkGlobStar(this.pattern),
      ])
    }
    return this.matches
  }

  walkSync(): Matches<O> {
    // consume all pattern portions except the last one.
    // if the last one is a string, then we stat and add it.
    while (this.pattern.hasMore()) {
      const p = this.pattern.pattern()
      if (typeof p === 'string') {
        this.path = this.path.child(p)
        this.pattern.shift()
      } else if (p instanceof RegExp) {
        // this fans out, but we must match the pattern against
        // something, so nothing else to do here.
        this.walkRegExpSync(p, this.pattern)
        this.pattern.shift()
        return this.matches
      } else {
        // globstar!
        // this fans out, but also continues without the **
        this.walkGlobStarSync(this.pattern)
        this.pattern.shift()
      }
    }
    const p = this.pattern.pattern()
    if (typeof p === 'string') {
      this.path = this.path.child(p)
      this.maybeMatchPathSync()
    } else if (p instanceof RegExp) {
      this.walkRegExpSync(p, this.pattern)
      return this.matches
    } else {
      // globstar at the end is either nothing, or all children
      // make sure our path actually exists, if it was something
      // like a/b/** we might've got here without checking
      this.maybeMatchPathSync()
      this.walkGlobStarSync(this.pattern)
    }
    return this.matches
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

  async walkGlobStar(pattern: Pattern): Promise<void> {
    // get all children, and walk from there
    if (!this.path.canReaddir()) {
      return
    }
    return new Promise<void>(res => {
      this.path.readdirCB((_er, entries) => {
        const promises: Promise<any>[] = []
        for (const e of entries) {
          if (e.name.startsWith('.')) continue
          else if (!e.isDirectory()) {
            promises.push(this.match(e))
          } else {
            const w = new GlobWalker<O>(
              pattern.copy(),
              e,
              this.matches,
              this.seen,
              this.opts
            )
            promises.push(w.walk())
          }
        }
        if (promises.length) return Promise.all(promises).then(() => res())
        else return res()
      }, true)
    })
  }

  walkGlobStarSync(pattern: Pattern): void {
    // get all children, and walk from there
    if (!this.path.canReaddir()) {
      return
    }
    const entries = this.path.readdirSync()
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      if (e.isSymbolicLink()) {
        // we can MATCH a symlink, just not traverse it
        this.matchSync(e)
        continue
      }
      const w = new GlobWalker<O>(
        pattern.copy(),
        e,
        this.matches,
        this.seen,
        this.opts
      )
      w.walkSync()
    }
  }

  async walkRegExp(p: RegExp, pattern: Pattern): Promise<void> {
    if (!this.path.canReaddir()) {
      return
    }
    return new Promise<void>(res => {
      this.path.readdirCB((_, entries) => {
        if (!pattern.hasMore()) {
          const promises: Promise<void>[] = []
          for (const e of entries) {
            if (p.test(e.name)) {
              promises.push(this.match(e))
            }
          }
          if (!entries.length) return res()
          Promise.all(promises).then(() => res())
        } else {
          const promises: Promise<any>[] = []
          for (const e of entries) {
            if (p.test(e.name)) {
              const w = new GlobWalker<O>(
                pattern.rest() as Pattern,
                e,
                this.matches,
                this.seen,
                this.opts
              )
              promises.push(w.walk())
            }
          }
          if (!entries.length) return res()
          Promise.all(promises).then(() => res())
        }
      }, true)
    })
  }

  walkRegExpSync(p: RegExp, pattern: Pattern): void {
    if (!this.path.canReaddir()) {
      return
    }
    const entries = this.path.readdirSync()
    if (!pattern.hasMore()) {
      for (const e of entries) {
        if (p.test(e.name)) this.matchSync(e)
      }
    } else {
      for (const e of entries) {
        if (p.test(e.name)) {
          const w = new GlobWalker<O>(
            pattern.rest() as Pattern,
            e,
            this.matches,
            this.seen,
            this.opts
          )
          w.walkSync()
        }
      }
    }
  }
}
