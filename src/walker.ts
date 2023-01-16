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

// a single minimatch set entry with 1 or more parts
type ParseReturnFiltered = string | RegExp | typeof GLOBSTAR
export type Pattern = [p: ParseReturnFiltered, ...rest: ParseReturnFiltered[]]

type Children = (GlobWalker | string)[]

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

  constructor(
    pattern: Pattern,
    path: string,
    options: GlobWalkerOptions | GlobWalker = {}
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
    } = options

    // if the pattern starts with a bunch of strings, then skip ahead
    this.pattern = [...pattern]
    this.path = path
    while (this.pattern.length > 1 && typeof this.pattern[0] === 'string') {
      this.path = this.join(this.pattern[0])
      this.pattern.shift()
    }
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

  child(pattern: Pattern, path: string) {
    return new GlobWalker(pattern, path, this)
  }

  async walk(): Promise<string[]> {
    if (this.ignore && this.ignore.childrenIgnored(this.path)) {
      return []
    }
    let entries: Dirent[]
    // if it's not a directory, or we can't read it, then
    // that means no match, because we still have pattern to consume
    try {
      entries = await this.rd.readdir(this.path || '.')
    } catch (_) {
      return []
    }
    const children = this.getChildren(entries)
    const matches: (string | string[])[] = await Promise.all(
      children.map(async c =>
        typeof c === 'string' ? this.finish(await this.doRealpath(c)) : c.walk()
      )
    )
    const flat = matches.reduce((set: string[], m) => set.concat(m), [])
    return this.ignore ? flat.filter(f => !this.ignore?.ignored(f)) : flat
  }

  finish(p: string | undefined): string | [] {
    if (!p) {
      return []
    }
    if (this.nodir || this.mark) {
      const isDir = this.rd.isDirectory(p)
      if (isDir) {
        if (this.nodir) {
          return []
        }
        if (p.substring(p.length - 1) !== '/') {
          return p + '/'
        }
      }
    }
    return p
  }

  async doRealpath(p: string): Promise<string | undefined> {
    if (!this.realpath && !this.absolute) {
      return p
    }
    if (!this.realpath) {
      return resolve(p)
    }
    const rp: string = await new Promise(res =>
      realpath(p, (er, rp) => (er ? res(resolve(p)) : res(rp)))
    )
    this.rd.alias(rp, p)
    return rp
  }

  doRealpathSync(p: string): string | undefined {
    if (!this.realpath && !this.absolute) {
      return p
    }
    if (!this.realpath) {
      return resolve(p)
    }
    let rp: string
    try {
      rp = realpathSync(p)
    } catch (_) {
      rp = resolve(p)
    }
    this.rd.alias(rp, p)
    return rp
  }

  walkSync(): string[] {
    if (this.ignore?.childrenIgnored(this.path)) {
      return []
    }
    let entries: Dirent[]
    // if it's not a directory, or we can't read it, then
    // that means no match, because we still have pattern to consume
    try {
      entries = this.rd.readdirSync(this.path || '.')
    } catch (e) {
      return []
    }
    const children = this.getChildren(entries)
    const matches: (string | string[])[] = children.map(c => {
      return typeof c === 'string'
        ? this.finish(this.doRealpathSync(c))
        : c.walkSync()
    })
    const flat = matches.reduce((set: string[], m) => set.concat(m), [])
    return this.ignore ? flat.filter(f => !this.ignore?.ignored(f)) : flat
  }

  join(p: string) {
    return this.path === ''
      ? p
      : this.path === '/'
      ? `${this.path}${p}`
      : `${this.path}/${p}`
  }

  getChildrenString(
    entries: Dirent[],
    p: string,
    rest: Pattern | null
  ): Children {
    const children: Children = []
    const e = entries.find(e => e.name === p)
    const traverse =
      p === '..' ||
      p === '.' ||
      p === '' ||
      (e && (e.isDirectory() || e.isSymbolicLink()))
    if (p === '.' || p === '' || p === '..' || e) {
      if (rest) {
        if (traverse) {
          children.push(this.child(rest, this.join(p)))
        }
      } else {
        children.push(this.join(p))
      }
    }
    return children
  }

  getChildrenGlobstar(entries: Dirent[], rest: Pattern | null): Children {
    const children: Children = []

    // eg, p=**/a/b
    if (rest) {
      // it can match a/b against this path, without the **
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
      const traverse = e.isDirectory() || (this.follow && e.isSymbolicLink())
      if (traverse) {
        children.push(this.child(this.pattern, path))
      }
      if (rest) {
        // can match a/b against child path
        children.push(this.child(rest, path))
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
      const traverse = e.isDirectory() || e.isSymbolicLink()
      if (rest) {
        if (traverse) {
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
