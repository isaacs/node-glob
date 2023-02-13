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
//
//
// NEW APPROACH
// Instead of recursively forking for each new chunk of the pattern, which gets
// a bit ridiculous when there's multiple globstars, let's try another
// approach.
// We just do a normal naive scurry, but where the set of possibly-matching
// patterns serve as a filter, which we update as we descend, passing them
// along.
//
// This ends up being equivalent if no globstars are present.  We just
// walk the dirs, consuming pattern parts as they match.
//
// However, when we have a **, the descent gets *both* the "consumed"
// pattern, *and* the full pattern with the **.
//
// Then for each child entry, for each active pattern, if it matches, then
// it consumes the next bit of the pattern, and continues with all the patterns
// that it matched on.  But if it's a globstar, then "consuming" means that we
// take the full globstar pattern set, as well as the pattern set without the
// globstar (ie, as if * was matched).
//
// This should result in only ever walking the tree a single time, as well as
// filtering out walk paths that can't possibly match anything.

import { GLOBSTAR } from 'minimatch'
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
  walked: Map<Path, Pattern[]>

  constructor(
    pattern: Pattern,
    path: Path,
    matches: Matches<O> | undefined,
    seen: Set<Path> | undefined,
    walked: Map<Path, Pattern[]> | undefined,
    opts: O
  )
  constructor(
    pattern: Pattern,
    path: Path,
    matches: Matches<O> | undefined,
    seen: Set<Path> | undefined,
    walked: Map<Path, Pattern[]> | undefined,
    opts: O
  ) {
    const root = pattern.root()
    if (root) {
      this.path = path.resolve(root)
    } else {
      this.path = path
    }
    this.pattern = pattern
    while (this.pattern.pattern() === '..') {
      this.pattern.index++
      this.path = this.path.parent || this.path
    }
    this.matches = (matches || new Set()) as Matches<O>
    this.opts = {
      absolute: !!root,
      ...opts,
    }
    this.seen = seen || new Set()
    this.walked = walked || new Map()
  }

  newWalks(target: Path, patterns: Pattern[]): Pattern[] {
    const walked = this.walked.get(target)
    if (!walked) {
      this.walked.set(target, patterns)
      return patterns
    }
    const todo: Pattern[] = []
    for (const p of patterns) {
      if (!walked.includes(p)) {
        todo.push(p)
        walked.push(p)
      }
    }
    return todo
  }

  // do the requisite realpath/stat checking, and return true/false
  // to say whether to include the match or filter it out.
  async matchCheck(e: Path): Promise<Path | undefined> {
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
      const r = await e.lstat()
      if (!r || this.seen.has(r) || (r.isDirectory() && this.opts.nodir)) {
        return undefined
      }
    } else if (this.seen.has(e) || (e.isDirectory() && this.opts.nodir)) {
      return undefined
    } else {
      return e
    }
  }

  matchCheckSync(e: Path): Path | undefined {
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
      const r = e.lstatSync()
      if (!r || this.seen.has(r) || (r.isDirectory() && this.opts.nodir)) {
        return undefined
      }
    } else if (this.seen.has(e) || (e.isDirectory() && this.opts.nodir)) {
      return undefined
    } else {
      return e
    }
  }

  matchFinish(e: Path) {
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
    const p = await this.matchCheck(e)
    if (p) this.matchFinish(p)
  }

  matchSync(e: Path): void {
    const p = this.matchCheckSync(e)
    if (p) this.matchFinish(p)
  }

  async walk(
    target: Path = this.path,
    patterns: Pattern[] = [this.pattern]
  ): Promise<Matches<O>> {
    if (target.isUnknown()) await target.lstat()
    return new Promise(res => {
      this.walkCB(target, patterns, () => res(this.matches))
    })
  }

  // XXX
  // ok just write this down then, this is getting hairy
  //
  // Get the list of patterns that the current target matches,
  // and also, any that the parent matches (if the pattern is ..)
  //
  // If any of those matches (for self or parent) are a single
  // part, then emit the match for them.
  //
  // If any matches for target have more, then walkCB with those on target
  // If any matches for parent have more, then walkCB with those on parent
  // but in both cases, only if the Path is walkable.
  // When we walkCB, it's with pattern.rest() in the case of everything
  // except globstar, which dupes both pattern and rest in the child set.
  //
  // So, for both target and parent:
  // 1 all that match and have more and start with **
  // 2 all that match and have more and do not start with **
  // 3 all that match and do not have more and are **
  // 4 all that match and do not have more and are not **
  // if dir:
  // - walk with all (1) duped+subbed, all (2) subbed, all (3) duped
  // - match if any (3) or (4)
  // if walkable:
  // - walk with all (1) subbed, all (2) subbed
  // - match if any (3) or (4)
  // else:
  // - match if any (3) or (4)

  walkCB(target: Path, patterns: Pattern[], cb: () => any) {
    // don't readdir just to get a string match, wasteful
    if (patterns.length === 1) {
      let p: MMPattern
      let rest: Pattern | null
      while (
        typeof (p = patterns[0].pattern()) === 'string' &&
        (rest = patterns[0].rest())
      ) {
        target = target.child(p)
        patterns[0] = rest
      }
    }

    target.readdirCB((_, entries) => {
      let tasks = 1
      const next = () => {
        if (--tasks <= 0) cb()
      }
      for (const e of entries) {
        tasks++
        this.walkCB2(e, patterns, next)
      }
      next()
    }, true)
  }

  // returns 0-2 length array of [path, isMatch, sub patterns][]
  getActions(
    target: Path,
    patterns: Pattern[]
  ): [Path, boolean, Pattern[]][] {
    const actions: [Path, boolean, Pattern[]][] = []
    const parent = target.parent || target
    const isGSWalkable = target.isDirectory()
    const isWalkable = isGSWalkable || target.canReaddir()
    const matchGS = !target.name.startsWith('.')
    const parentWalkPatterns: Pattern[] = []
    const targetWalkPatterns: Pattern[] = []
    let isParentMatch = false
    let isTargetMatch = false
    for (const pattern of patterns) {
      const p = pattern.pattern()
      const rest = pattern.rest()
      if (p === GLOBSTAR) {
        if (!matchGS) continue
        if (!rest) {
          if (isGSWalkable) targetWalkPatterns.push(pattern)
          isTargetMatch = true
        } else {
          if (isGSWalkable) targetWalkPatterns.push(pattern, rest)
        }
      } else if (p === '..') {
        if (!rest) isParentMatch = true
        else parentWalkPatterns.push(rest)
      } else if (p === '' || p === '.') {
        if (!rest) isTargetMatch = true
        else if (isWalkable) targetWalkPatterns.push(rest)
      } else if (typeof p === 'string' && p === target.name) {
        if (!rest) isTargetMatch = true
        else if (isWalkable) targetWalkPatterns.push(rest)
      } else if (p instanceof RegExp && p.test(target.name)) {
        if (!rest) isTargetMatch = true
        else if (isWalkable) targetWalkPatterns.push(rest)
      }
    }
    if (isParentMatch || parentWalkPatterns.length) {
      actions.push([
        parent,
        isParentMatch,
        this.newWalks(parent, parentWalkPatterns),
      ])
    }
    if (isTargetMatch || targetWalkPatterns.length) {
      actions.push([target, isTargetMatch, targetWalkPatterns])
    }
    return actions
  }

  walkCB2(target: Path, patterns: Pattern[], cb: () => any) {
    const actions = this.getActions(
      target,
      this.newWalks(target, patterns)
    )
    let tasks = 1
    const doneTask = () => {
      if (--tasks === 0) cb()
    }
    for (const [path, isMatch, patterns] of actions) {
      if (isMatch && !this.seen.has(path)) {
        tasks++
        this.match(path).then(doneTask)
      }
      if (patterns.length) {
        tasks++
        this.walkCB(path, patterns, doneTask)
      }
    }
    doneTask()
  }

  walkSync(
    target: Path = this.path,
    patterns: Pattern[] = [this.pattern]
  ): Matches<O> {
    if (target.isUnknown()) target.lstatSync()
    this.walkCBSync(target, patterns)
    return this.matches
  }

  walkCBSync(target: Path, patterns: Pattern[]) {
    // don't readdir just to get a string match, wasteful
    if (patterns.length === 1) {
      let p: MMPattern
      let rest: Pattern | null
      while (
        typeof (p = patterns[0].pattern()) === 'string' &&
        (rest = patterns[0].rest())
      ) {
        target = target.child(p)
        patterns[0] = rest
      }
    }

    const entries = target.readdirSync()
    for (const e of entries) {
      this.walkCB2Sync(e, patterns)
    }
  }

  walkCB2Sync(target: Path, patterns: Pattern[]) {
    const actions = this.getActions(
      target,
      this.newWalks(target, patterns)
    )
    for (const [path, isMatch, patterns] of actions) {
      if (isMatch && !this.seen.has(path)) {
        this.matchSync(path)
      }
      if (patterns.length) {
        this.walkCBSync(path, patterns)
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
}
