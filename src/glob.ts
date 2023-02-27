import { Minimatch, MinimatchOptions } from 'minimatch'
import Minipass from 'minipass'
import {
  Path,
  PathScurry,
  PathScurryDarwin,
  PathScurryPosix,
  PathScurryWin32,
} from 'path-scurry'
import {fileURLToPath} from 'url'
import { Ignore } from './ignore.js'
import { Pattern } from './pattern.js'
import { GlobStream, GlobWalker } from './walker.js'

export type MatchSet = Minimatch['set']
export type GlobParts = Exclude<Minimatch['globParts'], undefined>

// if no process global, just call it linux.
// so we default to case-sensitive, / separators
const defaultPlatform: NodeJS.Platform =
  typeof process === 'object' &&
  process &&
  typeof process.platform === 'string'
    ? process.platform
    : 'linux'

export interface GlobOptions {
  absolute?: boolean
  allowWindowsEscape?: boolean
  cwd?: string | URL
  dot?: boolean
  follow?: boolean
  ignore?: string | string[] | Ignore
  mark?: boolean
  matchBase?: boolean
  nobrace?: boolean
  nocase?: boolean
  nodir?: boolean
  noext?: boolean
  noglobstar?: boolean
  platform?: NodeJS.Platform
  realpath?: boolean
  scurry?: PathScurry
  signal?: AbortSignal
  windowsPathsNoEscape?: boolean
  withFileTypes?: boolean
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

export type Result<Opts> = Opts extends GlobOptionsWithFileTypesTrue
  ? Path
  : Opts extends GlobOptionsWithFileTypesFalse
  ? string
  : Opts extends GlobOptionsWithFileTypesUnset
  ? string
  : string | Path
export type Results<Opts> = Result<Opts>[]

export type FileTypes<Opts> = Opts extends GlobOptionsWithFileTypesTrue
  ? true
  : Opts extends GlobOptionsWithFileTypesFalse
  ? false
  : Opts extends GlobOptionsWithFileTypesUnset
  ? false
  : boolean

export class Glob<Opts extends GlobOptions> {
  absolute: boolean
  cwd: string
  dot: boolean
  follow: boolean
  ignore?: Ignore
  mark: boolean
  matchBase: boolean
  nobrace: boolean
  nocase: boolean
  nodir: boolean
  noext: boolean
  noglobstar: boolean
  pattern: string[]
  platform: NodeJS.Platform
  realpath: boolean
  scurry: PathScurry
  signal?: AbortSignal
  windowsPathsNoEscape: boolean
  withFileTypes: FileTypes<Opts>

  opts: Opts
  patterns: Pattern[]

  constructor(pattern: string | string[], opts: Opts) {
    this.withFileTypes = !!opts.withFileTypes as FileTypes<Opts>
    this.signal = opts.signal
    this.follow = !!opts.follow
    this.dot = !!opts.dot
    this.nodir = !!opts.nodir
    this.mark = !!opts.mark
    if (!opts.cwd) {
      this.cwd = ''
    } else if (opts.cwd instanceof URL || opts.cwd.startsWith('file://')) {
      opts.cwd = fileURLToPath(opts.cwd)
    }
    this.cwd = opts.cwd || ''
    this.nobrace = !!opts.nobrace
    this.noext = !!opts.noext
    this.realpath = !!opts.realpath
    this.absolute = !!opts.absolute

    this.noglobstar = !!opts.noglobstar
    this.matchBase = !!opts.matchBase

    if (this.withFileTypes && this.absolute) {
      throw new Error('cannot set absolute:true and withFileTypes:true')
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
      pattern = pattern.map(p => (p.includes('/') ? p : `./**/${p}`))
    }

    this.pattern = pattern

    this.platform = opts.platform || defaultPlatform
    this.opts = { ...opts, platform: this.platform }
    if (opts.scurry) {
      this.scurry = opts.scurry
      if (
        opts.nocase !== undefined &&
        opts.nocase !== opts.scurry.nocase
      ) {
        throw new Error('nocase option contradicts provided scurry option')
      }
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

    const mmo: MinimatchOptions = {
      // default nocase based on platform
      ...opts,
      dot: this.dot,
      matchBase: this.matchBase,
      nobrace: this.nobrace,
      nocase: this.nocase,
      nocaseMagicOnly: true,
      nocomment: true,
      noext: this.noext,
      nonegate: true,
      optimizationLevel: 2,
      platform: this.platform,
      windowsPathsNoEscape: this.windowsPathsNoEscape,
    }

    const mms = this.pattern.map(p => new Minimatch(p, mmo))
    const [matchSet, globParts] = mms.reduce(
      (set: [MatchSet, GlobParts], m) => {
        set[0].push(...m.set)
        set[1].push(...m.globParts)
        return set
      },
      [[], []]
    )
    this.patterns = matchSet.map((set, i) => {
      return new Pattern(set, globParts[i], 0, this.platform)
    })
  }

  async walk(): Promise<Results<Opts>>
  async walk(): Promise<(string | Path)[]> {
    // Walkers always return array of Path objects, so we just have to
    // coerce them into the right shape.  It will have already called
    // realpath() if the option was set to do so, so we know that's cached.
    // start out knowing the cwd, at least
    return [
      ...(await new GlobWalker(this.patterns, this.scurry.cwd, {
        ...this.opts,
        platform: this.platform,
        nocase: this.nocase,
      }).walk()),
    ]
  }

  walkSync(): Results<Opts>
  walkSync(): (string | Path)[] {
    return [
      ...new GlobWalker(this.patterns, this.scurry.cwd, {
        ...this.opts,
        platform: this.platform,
        nocase: this.nocase,
      }).walkSync(),
    ]
  }

  stream(): Minipass<Result<Opts>, Result<Opts>>
  stream(): Minipass<string | Path, string | Path> {
    return new GlobStream(this.patterns, this.scurry.cwd, {
      ...this.opts,
      platform: this.platform,
      nocase: this.nocase,
    }).stream()
  }

  streamSync(): Minipass<Result<Opts>, Result<Opts>>
  streamSync(): Minipass<string | Path, string | Path> {
    return new GlobStream(this.patterns, this.scurry.cwd, {
      ...this.opts,
      platform: this.platform,
      nocase: this.nocase,
    }).streamSync()
  }

  iterateSync(): Generator<Result<Opts>, void, void> {
    return this.streamSync()[Symbol.iterator]()
  }
  [Symbol.iterator]() {
    return this.iterateSync()
  }

  iterate(): AsyncGenerator<Result<Opts>, void, void> {
    return this.stream()[Symbol.asyncIterator]()
  }
  [Symbol.asyncIterator]() {
    return this.iterate()
  }
}
