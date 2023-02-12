import { Minimatch, MinimatchOptions } from 'minimatch'
import { Path, PathScurry } from 'path-scurry'
import { Ignore } from './ignore.js'
import { Pattern } from './pattern.js'
import { GlobWalker, Matches } from './walker.js'

type MatchSet = Minimatch['set']
type GlobSet = Exclude<Minimatch['globSet'], undefined>
type GlobParts = Exclude<Minimatch['globParts'], undefined>

export interface GlobOptions extends MinimatchOptions {
  ignore?: string | string[] | Ignore
  follow?: boolean
  mark?: boolean
  nodir?: boolean
  nounique?: boolean
  nosort?: boolean
  cwd?: string
  realpath?: boolean
  absolute?: boolean
  withFileTypes?: boolean
  scurry?: PathScurry
}

export type GlobOptionsWithFileTypesTrue = GlobOptions & {
  withFileTypes: true
}

export type GlobOptionsWithFileTypesFalse = GlobOptions & {
  withFileTypes?: false
}

export type GlobOptionsWithFileTypesUnset = GlobOptions & {
  withFileTypes?: undefined
}

type Result<Opts> = Opts extends GlobOptionsWithFileTypesTrue
  ? Path
  : Opts extends GlobOptionsWithFileTypesFalse
  ? string
  : Opts extends GlobOptionsWithFileTypesUnset
  ? string
  : string | Path
type Results<Opts> = Result<Opts>[]

type FileTypes<Opts> = Opts extends GlobOptionsWithFileTypesTrue
  ? true
  : Opts extends GlobOptionsWithFileTypesFalse
  ? false
  : Opts extends GlobOptionsWithFileTypesUnset
  ? false
  : boolean

export class Glob<Opts extends GlobOptions> {
  withFileTypes: FileTypes<Opts>
  pattern: string[]
  ignore?: Ignore
  follow: boolean
  dot: boolean
  mark: boolean
  nodir: boolean
  nounique: boolean
  nosort: boolean
  cwd: string
  matchSet: MatchSet
  globSet: GlobSet
  globParts: GlobParts
  realpath: boolean
  nonull: boolean
  absolute: boolean
  matchBase: boolean
  windowsPathsNoEscape: boolean
  noglobstar: boolean
  matches?: Matches<Opts>
  seen?: Set<Path>
  nocase?: boolean
  scurry: PathScurry
  opts: Opts

  constructor(pattern: string | string[], opts: Opts) {
    this.withFileTypes = !!opts.withFileTypes as FileTypes<Opts>
    const { ignore } = opts
    if (typeof ignore === 'string') {
      this.ignore = new Ignore([ignore])
    } else if (Array.isArray(ignore)) {
      this.ignore = new Ignore(ignore)
    } else if (ignore && ignore instanceof Ignore) {
      this.ignore = ignore
    }
    this.opts = opts
    this.follow = !!opts.follow
    this.dot = !!opts.dot
    this.nodir = !!opts.nodir
    this.mark = !!opts.mark
    this.nounique = !!opts.nounique
    this.nosort = !!opts.nosort
    this.cwd = opts.cwd || ''
    this.realpath = !!opts.realpath
    this.nonull = !!opts.nonull
    this.absolute = !!opts.absolute

    this.noglobstar = !!opts.noglobstar
    this.matchBase = !!opts.matchBase

    // if we're returning Path objects, we can't do nonull, because
    // the pattern is a string, not a Path
    if (this.withFileTypes) {
      if (this.nonull) {
        throw new TypeError(
          'cannot set nonull:true and withFileTypes:true'
        )
      }
      if (this.absolute) {
        throw new Error('cannot set absolute:true and withFileTypes:true')
      }
    }

    // if we want unique entries, we need a single set to hold them all
    if (!this.nounique) {
      this.matches = new Set() as Matches<Opts>
      this.seen = new Set()
    }

    if (typeof pattern === 'string') {
      pattern = [pattern]
    }

    this.windowsPathsNoEscape =
      !!opts.windowsPathsNoEscape ||
      (opts as GlobOptions).allowWindowsEscape === false

    if (this.windowsPathsNoEscape) {
      pattern = pattern.map(p => p.replace(/\\/g, '/'))
    }

    if (this.matchBase) {
      if (opts.noglobstar) {
        throw new TypeError('base matching requires globstar')
      }
      pattern = pattern.map(p => (p.includes('/') ? p : `**/${p}`))
    }

    this.pattern = pattern

    const mmo: MinimatchOptions = {
      ...opts,
      nonegate: true,
      nocomment: true,
      preserveMultipleSlashes: true,
    }

    const mms = this.pattern.map(p => new Minimatch(p, mmo))
    const [matchSet, globSet, globParts] = mms.reduce(
      (set: [MatchSet, GlobSet, GlobParts], m) => {
        set[0].push(...m.set)
        set[1].push(...m.globSet)
        set[2].push(...m.globParts)
        return set
      },
      [[], [], []]
    )
    this.matchSet = matchSet
    this.globSet = globSet
    this.globParts = globParts
    this.scurry =
      opts.scurry || new PathScurry(this.cwd, { nocase: opts.nocase })
  }

  process(): Promise<Results<Opts>>
  async process(): Promise<Results<Opts>> {
    // Walkers always return array of Path objects, so we just have to
    // coerce them into the right shape.  It will have already called
    // realpath() if the option was set to do so, so we know that's cached.
    // start out knowing the cwd, at least
    await this.scurry.lstat()
    const matches: Matches<Opts>[] = await Promise.all(
      this.matchSet.map(async (set, i) => {
        const p = new Pattern(set, this.globParts[i], 0)
        return await this.getWalker(p).walk()
      })
    )
    // TODO: nonull filling in the blanks
    return this.finish(matches)
  }

  processSync() {
    // start out knowing the cwd, at least
    this.scurry.lstatSync()
    const matches: Matches<Opts>[] = this.matchSet.map((set, i) => {
      const p = new Pattern(set, this.globParts[i], 0)
      return this.getWalker(p).walkSync()
    })
    return this.finish(matches)
  }

  finish(matches: Matches<Opts>[]): Results<Opts>
  finish(matches: Set<Path | string>[]): (string | Path)[] {
    if (this.nounique) {
      const raw: (string | Path)[] = []
      for (const set of matches) {
        for (const e of set) {
          raw.push(e)
        }
      }
      return raw
    } else {
      return [...matches[0]]
    }
  }

  sort(flat: string[]) {
    return this.nosort
      ? flat
      : flat.sort((a, b) => a.localeCompare(b, 'en'))
  }

  getWalker(pattern: Pattern): GlobWalker<Opts> {
    return new GlobWalker<Opts>(
      pattern,
      this.scurry.cwd,
      this.matches,
      this.seen,
      this.opts
    )
  }
}
