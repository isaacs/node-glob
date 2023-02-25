import { Minimatch, MinimatchOptions } from 'minimatch'
import Minipass from 'minipass'
import {
  Path,
  PathScurry,
  PathScurryDarwin,
  PathScurryPosix,
  PathScurryWin32,
} from 'path-scurry'
import { Ignore } from './ignore.js'
import { Pattern } from './pattern.js'
import { GlobStream, GlobWalker, Matches } from './walker.js'

type MatchSet = Minimatch['set']
type GlobSet = Exclude<Minimatch['globSet'], undefined>
type GlobParts = Exclude<Minimatch['globParts'], undefined>

// if no process global, just call it linux.
// so we default to case-sensitive, / separators
const defaultPlatform: NodeJS.Platform =
  typeof process === 'object' &&
  process &&
  typeof process.platform === 'string'
    ? process.platform
    : 'linux'

export interface GlobOptions extends MinimatchOptions {
  ignore?: string | string[] | Ignore
  follow?: boolean
  mark?: boolean
  nodir?: boolean
  cwd?: string
  realpath?: boolean
  absolute?: boolean
  withFileTypes?: boolean
  scurry?: PathScurry
  platform?: NodeJS.Platform
  signal?: AbortSignal
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
  walked?: Map<Path, Pattern[]>
  nocase?: boolean
  scurry: PathScurry
  opts: Opts
  globUtilOpts: Opts
  platform: NodeJS.Platform
  patterns: Pattern[]
  signal?: AbortSignal

  constructor(pattern: string | string[], opts: Opts) {
    this.withFileTypes = !!opts.withFileTypes as FileTypes<Opts>
    this.signal = opts.signal
    this.follow = !!opts.follow
    this.dot = !!opts.dot
    this.nodir = !!opts.nodir
    this.mark = !!opts.mark
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

    this.platform = opts.platform || defaultPlatform
    this.opts = { ...opts, platform: this.platform }
    if (opts.scurry) {
      this.scurry = opts.scurry
    } else {
      const Scurry =
        opts.platform === 'win32'
          ? PathScurryWin32
          : opts.platform === 'darwin'
          ? PathScurryDarwin
          : opts.platform
          ? PathScurryPosix
          : PathScurry
      this.scurry = new Scurry(this.cwd, { nocase: opts.nocase })
    }
    this.nocase = this.scurry.nocase

    this.globUtilOpts = {
      ...opts,
      platform: this.platform,
      nocase: this.nocase,
    }

    const mmo: MinimatchOptions = {
      // default nocase based on platform
      nocase: this.nocase,
      ...opts,
      nonegate: true,
      nocomment: true,
      nocaseMagicOnly: true,
      optimizationLevel: 2,
      platform: this.platform,
    }

    // console.error('glob pattern arg', this.pattern)
    const mms = this.pattern.map(p => new Minimatch(p, mmo))
    const [matchSet, globSet, globParts] = mms.reduce(
      (set: [MatchSet, GlobSet, GlobParts], m) => {
        // console.error('globparts', m.globParts)
        set[0].push(...m.set)
        set[1].push(...m.globSet)
        set[2].push(...m.globParts)
        return set
      },
      [[], [], []]
    )
    this.patterns = matchSet.map((set, i) => {
      // console.error('globParts', globParts[i])
      return new Pattern(set, globParts[i], 0, this.platform)
    })
    this.matchSet = matchSet
    this.globSet = globSet
    this.globParts = globParts
  }

  async walk(): Promise<Results<Opts>> {
    // Walkers always return array of Path objects, so we just have to
    // coerce them into the right shape.  It will have already called
    // realpath() if the option was set to do so, so we know that's cached.
    // start out knowing the cwd, at least
    const walker = new GlobWalker(
      this.patterns,
      this.scurry.cwd,
      { ...this.opts, platform: this.platform, nocase: this.nocase }
    )
    return this.finish(await walker.walk())
  }

  walkSync(): Results<Opts> {
    const walker = new GlobWalker(
      this.patterns,
      this.scurry.cwd,
      { ...this.opts, platform: this.platform, nocase: this.nocase }
    )
    return this.finish(walker.walkSync())
  }

  finish(matches: Matches<Opts>): Results<Opts>
  finish(matches: Set<Path | string>): (string | Path)[] {
    return [...matches]
  }

  stream(): Minipass<Result<Opts>>
  stream(): Minipass<string | Path> {
    return new GlobStream(
      this.patterns,
      this.scurry.cwd,
      { ...this.opts, platform: this.platform, nocase: this.nocase }
    ).stream()
  }

  streamSync(): Minipass<Result<Opts>>
  streamSync(): Minipass<string | Path> {
    return new GlobStream(
      this.patterns,
      this.scurry.cwd,
      { ...this.opts, platform: this.platform, nocase: this.nocase }
    ).streamSync()
  }

  iteratorSync(): Generator<Result<Opts>, void, void> {
    return this.streamSync()[Symbol.iterator]()
  }
  [Symbol.iterator]() {
    return this.iteratorSync()
  }

  iterator(): AsyncGenerator<Result<Opts>, void, void> {
    return this.stream()[Symbol.asyncIterator]()
  }
  [Symbol.asyncIterator]() {
    return this.iterator()
  }
}
