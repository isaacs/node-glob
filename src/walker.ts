// glob walker
// The simplest first pass at finding a bunch of paths matching a glob
// Takes a single pattern entry from the minimatch (string|re|globstar)[]
// and operate on a single path, fanning out to child entries as appropriate.
//
// - if pattern is empty, return [path]
// - readdir path
// - if ENOTDIR, return []
// - if pattern[0] is string (including '.' or '..') and pattern[0] in
//   entries, or pattern[0] is . or ..
//   - return walk(dir+pattern[0], pattern.slice(1))
// - if pattern[0] is globstar:
//   - return walk all entries with pattern AND pattern.slice(1) if len>1
// - discard any entries that don't match pattern[0]
// - child walk remaining entries with pattern.slice(1)
// - return all matching child walks

import { Dirent, realpath, realpathSync } from 'fs'
import { GLOBSTAR } from 'minimatch'
import { resolve } from 'path'
import { Ignore } from './ignore.js'
import { GlobCache, Readdir } from './readdir.js'

type MMRegExp = RegExp & { _glob: string }

// a single minimatch set entry with 1 or more parts
type ParseReturnFiltered = string | MMRegExp | typeof GLOBSTAR
export type Pattern = [
  p: ParseReturnFiltered,
  ...rest: ParseReturnFiltered[]
]

type Children = (GlobWalker | string | undefined)[]

export interface GlobWalkerOptions {
  follow?: boolean
  rd?: Readdir
  cache?: GlobCache
  realpath?: boolean
  mark?: boolean
  nodir?: boolean
  ignore?: string | string[] | Ignore
  dot?: boolean
  absolute?: boolean
  cwd?: string
  matches?: Set<string>
  seen?: Map<string, Set<string>>
}

export class GlobWalker {
  pattern: Pattern
  path: string
  follow: boolean
  rd: Readdir
  realpath: boolean
  absolute: boolean
  mark: boolean
  nodir: boolean
  dot: boolean
  ignore?: Ignore
  cache: GlobCache
  cwd: string
  start: string
  hasParent: boolean
  matches: Set<string>
  seen: Map<string, Set<string>>

  //pkey: string

  constructor(
    pattern: Pattern,
    path: string,
    options: GlobWalkerOptions | GlobWalker = {},
    hasParent: boolean = false
  ) {
    const {
      follow = false,
      realpath = false,
      absolute = false,
      mark = false,
      nodir = false,
      dot = false,
      rd,
      cache,
      ignore,
      cwd = '',
      matches = new Set(),
      seen = new Map(),
    } = options

    this.matches = matches
    this.hasParent = hasParent
    this.seen = seen

    //this.pkey = pattern
    //  .map(p =>
    //    p === GLOBSTAR ? '**' : p instanceof RegExp ? p._glob : p
    //  )
    //  .join('/')
    //const pathSeen = seen.get(path)
    //if (!pathSeen) {
    //  seen.set(path, new Set([this.pkey]))
    //} else {
    //  pathSeen.add(this.pkey)
    //}

    // if the pattern starts with a bunch of strings, then skip ahead
    this.pattern = [...pattern]
    this.path = path
    this.cwd = cwd
    this.start = this.setStart()
    this.follow = follow
    this.realpath = realpath
    this.absolute = absolute
    this.mark = mark
    this.nodir = nodir
    this.rd = rd ? rd : new Readdir(cache)
    this.cache = this.rd.cache
    this.dot = dot
    if (typeof ignore === 'string') {
      this.ignore = new Ignore([ignore])
    } else if (Array.isArray(ignore)) {
      this.ignore = new Ignore(ignore)
    } else if (ignore instanceof Ignore) {
      this.ignore = ignore
    }
  }

  // TODO: this belongs in the Glob class probably
  // since then we can remove the parent bit.
  // Also, then we can ditch the cwd
  setStart() {
    const [first, ...rest] = this.pattern
    // a pattern like /a/s/d/f discards the cwd
    // a pattern like / (or c:/ on windows) can only match the root
    if (typeof first === 'string' && !this.hasParent) {
      const patternSlash = first === '' && !!rest.length
      const isWin = process.platform === 'win32'
      const patternDrive = isWin && /^[a-z]:$/i.test(first)
      const setAbs = patternSlash || patternDrive
      if (setAbs) {
        // a pattern like '/' on windows goes to the root of
        // the drive that cwd is on.  If cwd isn't on a drive, use /
        const cwd = this.cwd ? this.join(this.path, this.cwd) : this.path
        const cwdRe = /^[a-z]:($|[\\\/])/i
        const cwdDrive = isWin && patternSlash && cwd.match(cwdRe)
        // don't mount UNC paths on a drive letter
        // eg: //?/c:/* or //host/share/*
        // Only relevant if we WOULD have tried to mount it
        // We'll gobble those strings shortly, so use '/' for now
        const isUNC =
          cwdDrive &&
          first === '' &&
          rest[0] === '' &&
          rest[1] &&
          typeof rest[1] === 'string' &&
          rest[2] &&
          typeof rest[2] === 'string'
        const root = isUNC
          ? '/'
          : cwdDrive
          ? cwdDrive[0]
          : isWin
          ? resolve('/')
          : ''
        if (isUNC && rest.length === 3) {
          rest.push('')
        }
        this.pattern = rest.length ? (rest as Pattern) : ['']
        this.cwd = first || root
        this.path = first || root || '/'
      }
    }

    // skip ahead any literal portions, and read that dir instead
    while (
      this.pattern.length > 1 &&
      typeof this.pattern[0] === 'string'
    ) {
      this.path =
        this.path === '/'
          ? this.path + this.pattern[0]
          : this.join(this.pattern[0])
      this.pattern.shift()
    }

    // match bash behavior, discard any empty path portions that
    // follow a path portion with magic chars
    while (
      (this.pattern[0] instanceof RegExp ||
        this.pattern[0] === GLOBSTAR) &&
      this.pattern[1] === '' &&
      this.pattern.length > 2
    ) {
      this.pattern.splice(1, 1)
    }

    // this is the dir to read
    return this.join(this.path, this.cwd) || '.'
  }

  // don't do the same walk more than one time, ever
  // hasSeen(pattern: Pattern, path: string): boolean {
  //   const seenPath = this.seen.get(path)
  //   if (seenPath) {
  //     const pkey = pattern
  //       .map(e =>
  //         e === GLOBSTAR ? '**' : e instanceof RegExp ? e._glob : e
  //       )
  //       .join('/')
  //     if (seenPath.has(pkey)) {
  //       return true
  //     }
  //   }
  //   return false
  // }

  child(pattern: Pattern, path: string) {
    //if (!this.hasSeen(pattern, path)) {
    return new GlobWalker(pattern, path, this, true)
    //}
  }

  match(p: string): void {
    if (!this.ignore?.ignored(p)) {
      this.matches.add(p)
    }
  }

  finish(p: string): void {
    if (!p || this.ignore?.ignored(p)) {
      return
    }
    if (this.nodir || this.mark) {
      const isDir = this.rd.isDirectory(this.join(p, this.cwd))
      if (isDir) {
        if (this.nodir) {
          return
        }
        if (p.substring(p.length - 1) !== '/') {
          this.match(p + '/')
          return
        }
      }
    }
    this.match(p)
  }

  async doRealpath(p: string): Promise<string> {
    if (!this.realpath && !this.absolute) {
      return p
    }
    const pp = resolve(this.join(p, this.cwd))
    if (!this.realpath) {
      return pp
    }
    return await new Promise(res =>
      realpath(pp, (er, rp) => (er ? res(pp) : res(rp)))
    )
  }

  doRealpathSync(p: string): string {
    if (!this.realpath && !this.absolute) {
      return p
    }
    const pp = resolve(this.join(p, this.cwd))
    if (!this.realpath) {
      return pp
    }
    try {
      return realpathSync(pp)
    } catch (_) {
      return pp
    }
  }

  async walk(): Promise<Set<string>> {
    if (this.ignore?.childrenIgnored(this.path)) {
      return this.matches
    }
    let entries: Dirent[] | false = await this.rd.readdir(this.start)
    if (!entries) {
      return this.matches
    }
    const children = this.getChildren(entries)
    await Promise.all(
      children.map(async c =>
        typeof c === 'string'
          ? this.finish(await this.doRealpath(c))
          : c?.walk()
      )
    )
    return this.matches
  }

  walkSync(): Set<string> {
    if (this.ignore?.childrenIgnored(this.path)) {
      return this.matches
    }
    let entries: Dirent[] | false = this.rd.readdirSync(this.start)
    if (!entries) {
      return this.matches
    }
    const children = this.getChildren(entries)
    for (const c of children) {
      if (typeof c === 'string') {
        this.finish(this.doRealpathSync(c))
      } else {
        c?.walkSync()
      }
    }
    return this.matches
  }

  join(p: string, base: string = this.path) {
    return base === ''
      ? p
      : base === '/' && p
      ? `${base}${p}`
      : `${base}/${p}`
  }

  getChildrenString(
    entries: Dirent[],
    p: string,
    rest: Pattern | null
  ): Children {
    const children: Children = []
    const e =
      p !== '' &&
      p !== '.' &&
      p !== '..' &&
      entries.find(e => e.name === p)

    // since we pull all string portions up to minimize readdir() calls,
    // the only way we can possibly have a rest here is if something
    // OTHER than a string comes next.
    // However, if we're landing on ., '', .., or a string that matches
    // an entry in the directory we just read, then it's a match.
    if ((p === '.' || p === '' || p === '..' || e) && !rest) {
      children.push(this.join(p))
    }
    return children
  }

  getChildrenGlobstar(entries: Dirent[], rest: Pattern | null): Children {
    const children: Children = []

    // eg, p=**/a/b
    if (rest) {
      // XXX this is faster, but it breaks some bash comparisons
      // also, it's still not fast enough, even with this.
      //
      // it can match a/b against this path, without the **
      // skip ahead one step
      // const p = rest[0]
      // const r = rest.length > 1 ? rest.slice(1) as Pattern : null
      // if (typeof p === 'string') {
      //   children.push(...this.getChildrenString(entries, p, r))
      // } else if (p instanceof RegExp) {
      //   children.push(...this.getChildrenRegexp(entries, p, r))
      // }
      children.push(this.child(rest, this.path))
    } else {
      // but if ** is at the end, then this path definitely matches
      children.push(this.path)
    }

    for (const e of entries) {
      if (!this.dot && e.name.startsWith('.')) {
        continue
      }
      const path = this.join(e.name)
      // ** does not traverse symlinks, unless follow:true is set.
      const traverse =
        e.isDirectory() || (this.follow && e.isSymbolicLink())
      if (traverse) {
        children.push(this.child(this.pattern, path))
      }
      if (rest) {
        // TODO: match bash behavior
        // **/a will not traverse symlinks, but ./**/a WILL traverse
        // a single symlink
        if (e.isSymbolicLink()) {
          // can match a/b against child path
          children.push(this.child(rest, path))
        }
      } else {
        // ** at the end, will match all children
        children.push(path)
      }
    }

    return children
  }

  getChildrenRegexp(
    entries: Dirent[],
    p: RegExp,
    rest: Pattern | null
  ): Children {
    const children: Children = []
    for (const e of entries) {
      if (!p.test(e.name)) {
        continue
      }
      if (rest) {
        if (e.isDirectory() || e.isSymbolicLink()) {
          children.push(this.child(rest, this.join(e.name)))
        }
      } else {
        children.push(this.join(e.name))
      }
    }

    return children
  }

  getChildren(entries: Dirent[]): Children {
    const [p, ...tail] = this.pattern
    const rest = tail.length ? (tail as Pattern) : null
    if (typeof p === 'string') {
      return this.getChildrenString(entries, p, rest)
    } else if (p === GLOBSTAR) {
      return this.getChildrenGlobstar(entries, rest)
    } else {
      return this.getChildrenRegexp(entries, p, rest)
    }
  }
}
