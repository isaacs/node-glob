import { Minimatch, MinimatchOptions } from 'minimatch'
import {resolve} from 'path'
import { GlobCache } from './readdir.js'
import { GlobWalker, Pattern } from './walker.js'

type MatchSet = Minimatch['set']
type GlobSet = Exclude<Minimatch['globSet'], undefined>

export interface GlobOptions extends MinimatchOptions {
  ignore?: string | string[]
  follow?: boolean
  mark?: boolean
  nodir?: boolean
  nounique?: boolean
  nosort?: boolean
  cwd?: string
  realpath?: boolean
  absolute?: boolean
  cache?: GlobCache
}

export class Glob {
  pattern: string[]
  ignore?: string | string[]
  follow: boolean
  dot: boolean
  mark: boolean
  nodir: boolean
  nounique: boolean
  nosort: boolean
  cwd: string
  matchSet: MatchSet
  globSet: GlobSet
  realpath: boolean
  nonull: boolean
  absolute: boolean
  matchBase: boolean
  windowsPathsNoEscape: boolean
  noglobstar: boolean
  cache: GlobCache

  constructor(pattern: string | string[], options: GlobOptions | Glob = {}) {
    this.ignore = options.ignore
    this.follow = !!options.follow
    this.dot = !!options.dot
    this.nodir = !!options.nodir
    this.mark = !!options.mark
    this.nounique = !!options.nounique
    this.nosort = !!options.nosort
    this.cwd = options.cwd || ''
    if (process.platform === 'win32') {
      this.cwd = this.cwd.replace(/\\/g, '/')
    }
    this.realpath = !!options.realpath
    this.nonull = !!options.nonull
    this.absolute = !!options.absolute
    this.cache = options.cache || Object.create(null)

    this.noglobstar = !!options.noglobstar
    this.matchBase = !!options.matchBase

    if (typeof pattern === 'string') {
      pattern = [pattern]
    }

    this.windowsPathsNoEscape =
      !!options.windowsPathsNoEscape ||
      (options as GlobOptions).allowWindowsEscape === false

    if (this.windowsPathsNoEscape) {
      pattern = pattern.map(p => p.replace(/\\/g, '/'))
    }

    if (this.matchBase) {
      if (options.noglobstar) {
        throw new TypeError('base matching requires globstar')
      }
      pattern = pattern.map(p => (p.includes('/') ? p : `**/${p}`))
    }

    this.pattern = pattern

    const mmo = { ...options, nonegate: true, nocomment: true }
    const mms = this.pattern.map(p => new Minimatch(p, mmo))
    this.matchSet = mms.reduce((set: MatchSet, m) => set.concat(m.set), [])
    this.globSet = mms.reduce((set: GlobSet, m) => set.concat(m.globSet), [])
  }

  doNonull(matches: string[], i: number) {
    if (!matches.length && this.nonull) {
      const gs: string | undefined = this.globSet[i]
      if (gs) {
        return [gs]
      } else {
        return []
      }
    }
    return matches
  }

  async process() {
    return this.finish(
      await Promise.all(
        this.matchSet.map(async (set, i) => {
          if (!set.length) {
            return []
          }
          const matches = await this.getWalker(set as Pattern).walk()
          return this.doNonull(matches, i)
        })
      )
    )
  }

  finish(matches: string[][]): string[] {
    const raw = matches.reduce((set, m) => set.concat(m), [])
    const flat = this.nounique ? raw : [...new Set(raw)]
    return this.nosort ? flat : flat.sort((a, b) => a.localeCompare(b, 'en'))
  }

  getWalker(set: Pattern) {
    // if the set starts with an absolute path, then start there
    const first = set[0]
    const setAbs =
      typeof first === 'string' &&
      (first === '' ||
        (process.platform === 'win32' && /^[a-z]:$/i.test(first)))
    if (setAbs) {
      set.shift()
    }
    const start = setAbs ? first + '/' : this.cwd
    return new GlobWalker(set, start, this)
  }

  processSync() {
    return this.finish(
      this.matchSet.map((set, i) => {
        if (!set.length) {
          return []
        }
        return this.doNonull(this.getWalker(set as Pattern).walkSync(), i)
      })
    )
  }
}