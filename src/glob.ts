import Minipass from 'minipass'
import {
  Path,
  PathScurry,
  PathScurryDarwin,
  PathScurryPosix,
  PathScurryWin32,
} from 'path-scurry'
import { Ignore } from './ignore.js'
import { Matcher, MatcherOpts } from './matcher.js'
import { Pattern } from './pattern.js'
import { GlobStream, GlobWalker, Matches } from './walker.js'

// if no process global, just call it linux.
// so we default to case-sensitive, / separators
/* c8 ignore start */
const defaultPlatform =
  typeof process === 'object' &&
  process &&
  typeof process.platform === 'string'
    ? process.platform
    : 'linux'
/* c8 ignore stop */

export interface GlobOptions extends MatcherOpts {
  ignore?: string | string[] | Ignore
  follow?: boolean
  mark?: boolean
  nodir?: boolean
  nounique?: boolean
  cwd?: string
  realpath?: boolean
  absolute?: boolean
  withFileTypes?: boolean
  scurry?: PathScurry
  platform?: typeof process.platform
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
  cwd: string
  realpath: boolean
  absolute: boolean
  windowsPathsNoEscape: boolean
  noglobstar: boolean
  matches?: Matches<Opts>
  seen?: Set<Path>
  walked?: Map<Path, Pattern[]>
  nocase?: boolean
  scurry: PathScurry
  opts: Opts
  platform?: typeof process.platform
  patterns: Pattern[]
  matcher: Matcher

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
    this.cwd = opts.cwd || ''
    this.realpath = !!opts.realpath
    this.absolute = !!opts.absolute

    this.noglobstar = !!opts.noglobstar

    // if we're returning Path objects, we can't do nonull, because
    // the pattern is a string, not a Path
    if (this.withFileTypes && this.absolute) {
      throw new Error('cannot set absolute:true and withFileTypes:true')
    }

    this.matches = new Set() as Matches<Opts>
    this.seen = new Set()
    this.walked = new Map()

    if (typeof pattern === 'string') {
      pattern = [pattern]
    }

    this.windowsPathsNoEscape = !!opts.windowsPathsNoEscape

    if (this.windowsPathsNoEscape) {
      pattern = pattern.map(p => p.replace(/\\/g, '/'))
    }

    this.pattern = pattern

    this.platform = opts.platform || defaultPlatform
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

    const mmo: MatcherOpts = {
      // default nocase based on platform
      nocase: this.scurry.nocase,
      platform: this.platform,
      ...opts,
    }

    // console.error('glob pattern arg', this.pattern)
    this.matcher = new Matcher(this.pattern, mmo)
    this.patterns = this.matcher.patterns
  }

  async walk(): Promise<Results<Opts>> {
    // Walkers always return array of Path objects, so we just have to
    // coerce them into the right shape.  It will have already called
    // realpath() if the option was set to do so, so we know that's cached.
    // start out knowing the cwd, at least
    const walker = new GlobWalker(
      this.patterns,
      this.scurry.cwd,
      this.opts
    )
    return this.finish(await walker.walk())
  }

  walkSync(): Results<Opts> {
    const walker = new GlobWalker(
      this.patterns,
      this.scurry.cwd,
      this.opts
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
      this.opts
    ).stream()
  }

  streamSync(): Minipass<Result<Opts>>
  streamSync(): Minipass<string | Path> {
    return new GlobStream(
      this.patterns,
      this.scurry.cwd,
      this.opts
    ).streamSync()
  }
}
