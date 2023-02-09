import {Minimatch, MinimatchOptions} from 'minimatch'
import {Path, PathScurry} from 'path-scurry'
import {Ignore} from './ignore.js'
import {Pattern} from './pattern.js'
import {GlobWalker} from './walker.js'

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

type Results<Opts> = Opts extends GlobOptionsWithFileTypesTrue
    ? Path[]
    : Opts extends GlobOptionsWithFileTypesFalse
    ? string[]
    : Opts extends GlobOptionsWithFileTypesUnset
    ? string[]
    : string[] | Path[]

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
  matches?: Set<Path>
  nocase?: boolean
  scurry: PathScurry

  constructor(pattern: string | string[], options: Opts) {
    this.withFileTypes = !!options.withFileTypes as FileTypes<Opts>
    const { ignore } = options
    if (typeof ignore === 'string') {
      this.ignore = new Ignore([ignore])
    } else if (Array.isArray(ignore)) {
      this.ignore = new Ignore(ignore)
    } else if (ignore && (ignore instanceof Ignore)) {
      this.ignore = ignore
    }
    this.follow = !!options.follow
    this.dot = !!options.dot
    this.nodir = !!options.nodir
    this.mark = !!options.mark
    this.nounique = !!options.nounique
    this.nosort = !!options.nosort
    this.cwd = options.cwd || ''
    this.realpath = !!options.realpath
    this.nonull = !!options.nonull
    this.absolute = !!options.absolute

    this.noglobstar = !!options.noglobstar
    this.matchBase = !!options.matchBase

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
      this.matches = new Set()
    }

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

    const mmo: MinimatchOptions = {
      ...options,
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
      options.scurry ||
      new PathScurry(this.cwd, { nocase: options.nocase })
  }

  process(): Promise<Results<Opts>>
  async process(): Promise<string[] | Path[]> {
    // Walkers always return array of Path objects, so we just have to
    // coerce them into the right shape.  It will have already called
    // realpath() if the option was set to do so, so we know that's cached.
    const matches: Set<Path>[] = await Promise.all(
      this.matchSet.map(async (set, i) => {
        const p = new Pattern(set, this.globParts[i], 0)
        return await this.getWalker(p).walk()
      })
    )
    // TODO: nonull filling in the blanks
    return this.finish(matches)
  }

  processSync() {
    const matches: Set<Path>[] = this.matchSet.map((set, i) => {
      const p = new Pattern(set, this.globParts[i], 0)
      return this.getWalker(p).walkSync()
    })
    return this.finish(matches)
  }

  finish(
    matches: Set<Path>[]
  ): Results<Opts>
  finish(matches: Set<Path>[]): string[] | Path[] {
    const raw: Path[] = []
    if (this.nounique) {
      for (const set of matches) {
        raw.push(...set)
      }
    } else {
      raw.push(...matches[0])
    }
    return this.withFileTypes
      ? raw
      : this.absolute
      ? this.sort(raw.map(r => r.fullpath()))
      : this.realpath
      ? this.sort(
          raw.map(r => (r.realpathCached() || r).fullpath())
        )
      : this.sort(raw.map(r => r.fullpath()))
  }

  sort(flat: string[]) {
    return this.nosort
      ? flat
      : flat.sort((a, b) => a.localeCompare(b, 'en'))
  }

  getWalker(pattern: Pattern) {
    return new GlobWalker(pattern, this.scurry.cwd, this.matches)
  }
}
