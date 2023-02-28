/**
 * Single-use utility classes to provide functionality to the {@link Glob}
 * methods.
 *
 * @module
 */
import Minipass from 'minipass'
import { Path } from 'path-scurry'
import { Ignore } from './ignore.js'

// XXX can we somehow make it so that it NEVER processes a given path more than
// once, enough that the match set tracking is no longer needed?  that'd speed
// things up a lot.  Or maybe bring back nounique, and skip it in that case?

// a single minimatch set entry with 1 or more parts
import { Pattern } from './pattern.js'
import { Processor } from './processor.js'

export interface GlobWalkerOpts {
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
  root?: string
  signal?: AbortSignal
  windowsPathsNoEscape?: boolean
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

export type MatchStream<O extends GlobWalkerOpts> =
  O extends GWOFileTypesTrue
    ? Minipass<Path, Path>
    : O extends GWOFileTypesFalse
    ? Minipass<string, string>
    : O extends GWOFileTypesUnset
    ? Minipass<string, string>
    : Minipass<Path | string, Path | string>

const makeIgnore = (
  ignore: string | string[] | Ignore,
  opts: GlobWalkerOpts
): Ignore =>
  typeof ignore === 'string'
    ? new Ignore([ignore], opts)
    : Array.isArray(ignore)
    ? new Ignore(ignore, opts)
    : /* c8 ignore start */
      ignore
/* c8 ignore stop */

/**
 * basic walking utilities that all the glob walker types use
 */
export abstract class GlobUtil<O extends GlobWalkerOpts = GlobWalkerOpts> {
  path: Path
  patterns: Pattern[]
  opts: O
  seen: Set<Path> = new Set<Path>()
  paused: boolean = false
  aborted: boolean = false
  #onResume: (() => any)[] = []
  #ignore?: Ignore
  #sep: '\\' | '/'
  signal?: AbortSignal

  constructor(patterns: Pattern[], path: Path, opts: O)
  constructor(patterns: Pattern[], path: Path, opts: O) {
    this.patterns = patterns
    this.path = path
    this.opts = opts
    this.#sep = opts.platform === 'win32' ? '\\' : '/'
    if (opts.ignore) {
      this.#ignore = makeIgnore(opts.ignore, opts)
    }
    if (opts.signal) {
      this.signal = opts.signal
      this.signal.addEventListener('abort', () => {
        this.#onResume.length = 0
      })
    }
  }

  #ignored(path: Path): boolean {
    return this.seen.has(path) || !!this.#ignore?.ignored(path)
  }
  #childrenIgnored(path: Path): boolean {
    return !!this.#ignore?.childrenIgnored(path)
  }

  // backpressure mechanism
  pause() {
    this.paused = true
  }
  resume() {
    /* c8 ignore start */
    if (this.signal?.aborted) return
    /* c8 ignore stop */
    this.paused = false
    let fn: (() => any) | undefined = undefined
    while (!this.paused && (fn = this.#onResume.shift())) {
      fn()
    }
  }
  onResume(fn: () => any) {
    if (this.signal?.aborted) return
    /* c8 ignore start */
    if (!this.paused) {
      fn()
    } else {
      /* c8 ignore stop */
      this.#onResume.push(fn)
    }
  }

  // do the requisite realpath/stat checking, and return the path
  // to add or undefined to filter it out.
  async matchCheck(e: Path, ifDir: boolean): Promise<Path | undefined> {
    if (ifDir && this.opts.nodir) return undefined
    let rpc: Path | undefined
    if (this.opts.realpath) {
      rpc = e.realpathCached() || (await e.realpath())
      if (!rpc) return undefined
      e = rpc
    }
    const needStat = e.isUnknown()
    return this.matchCheckTest(needStat ? await e.lstat() : e, ifDir)
  }

  matchCheckTest(e: Path | undefined, ifDir: boolean): Path | undefined {
    return e &&
      !this.#ignored(e) &&
      (!ifDir || e.canReaddir()) &&
      (!this.opts.nodir || !e.isDirectory())
      ? e
      : undefined
  }

  matchCheckSync(e: Path, ifDir: boolean): Path | undefined {
    if (ifDir && this.opts.nodir) return undefined
    let rpc: Path | undefined
    if (this.opts.realpath) {
      rpc = e.realpathCached() || e.realpathSync()
      if (!rpc) return undefined
      e = rpc
    }
    const needStat = e.isUnknown()
    return this.matchCheckTest(needStat ? e.lstatSync() : e, ifDir)
  }

  abstract matchEmit(p: Result<O>): void
  abstract matchEmit(p: string | Path): void

  matchFinish(e: Path, absolute: boolean) {
    if (this.#ignored(e)) return
    const abs =
      this.opts.absolute === undefined ? absolute : this.opts.absolute
    this.seen.add(e)
    const mark = this.opts.mark && e.isDirectory() ? this.#sep : ''
    // ok, we have what we need!
    if (this.opts.withFileTypes) {
      this.matchEmit(e)
    } else if (abs) {
      this.matchEmit(e.fullpath() + mark)
    } else {
      const rel = e.relative()
      this.matchEmit(!rel && mark ? '.' + mark : rel + mark)
    }
  }

  async match(e: Path, absolute: boolean, ifDir: boolean): Promise<void> {
    const p = await this.matchCheck(e, ifDir)
    if (p) this.matchFinish(p, absolute)
  }

  matchSync(e: Path, absolute: boolean, ifDir: boolean): void {
    const p = this.matchCheckSync(e, ifDir)
    if (p) this.matchFinish(p, absolute)
  }

  walkCB(target: Path, patterns: Pattern[], cb: () => any) {
    /* c8 ignore start */
    if (this.signal?.aborted) cb()
    /* c8 ignore stop */
    this.walkCB2(target, patterns, new Processor(this.opts), cb)
  }

  walkCB2(
    target: Path,
    patterns: Pattern[],
    processor: Processor,
    cb: () => any
  ) {
    if (this.#childrenIgnored(target)) return cb()
    if (this.signal?.aborted) cb()
    if (this.paused) {
      this.onResume(() => this.walkCB2(target, patterns, processor, cb))
      return
    }
    processor.processPatterns(target, patterns)

    // done processing.  all of the above is sync, can be abstracted out.
    // subwalks is a map of paths to the entry filters they need
    // matches is a map of paths to [absolute, ifDir] tuples.
    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.#ignored(m)) continue
      tasks++
      this.match(m, absolute, ifDir).then(() => next())
    }

    for (const t of processor.subwalkTargets()) {
      tasks++
      const childrenCached = t.readdirCached()
      if (t.calledReaddir())
        this.walkCB3(t, childrenCached, processor, next)
      else {
        t.readdirCB(
          (_, entries) => this.walkCB3(t, entries, processor, next),
          true
        )
      }
    }

    next()
  }

  walkCB3(
    target: Path,
    entries: Path[],
    processor: Processor,
    cb: () => any
  ) {
    processor = processor.filterEntries(target, entries)

    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.#ignored(m)) continue
      tasks++
      this.match(m, absolute, ifDir).then(() => next())
    }
    for (const [target, patterns] of processor.subwalks.entries()) {
      tasks++
      this.walkCB2(target, patterns, processor.child(), next)
    }

    next()
  }

  walkCBSync(target: Path, patterns: Pattern[], cb: () => any) {
    /* c8 ignore start */
    if (this.signal?.aborted) cb()
    /* c8 ignore stop */
    this.walkCB2Sync(target, patterns, new Processor(this.opts), cb)
  }

  walkCB2Sync(
    target: Path,
    patterns: Pattern[],
    processor: Processor,
    cb: () => any
  ) {
    if (this.#childrenIgnored(target)) return cb()
    if (this.signal?.aborted) cb()
    if (this.paused) {
      this.onResume(() =>
        this.walkCB2Sync(target, patterns, processor, cb)
      )
      return
    }
    processor.processPatterns(target, patterns)

    // done processing.  all of the above is sync, can be abstracted out.
    // subwalks is a map of paths to the entry filters they need
    // matches is a map of paths to [absolute, ifDir] tuples.
    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.#ignored(m)) continue
      this.matchSync(m, absolute, ifDir)
    }

    for (const t of processor.subwalkTargets()) {
      tasks++
      const children = t.readdirSync()
      this.walkCB3Sync(t, children, processor, next)
    }

    next()
  }

  walkCB3Sync(
    target: Path,
    entries: Path[],
    processor: Processor,
    cb: () => any
  ) {
    processor = processor.filterEntries(target, entries)

    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.#ignored(m)) continue
      this.matchSync(m, absolute, ifDir)
    }
    for (const [target, patterns] of processor.subwalks.entries()) {
      tasks++
      this.walkCB2Sync(target, patterns, processor.child(), next)
    }

    next()
  }
}

export class GlobWalker<
  O extends GlobWalkerOpts = GlobWalkerOpts
> extends GlobUtil<O> {
  matches: O extends GWOFileTypesTrue
    ? Set<Path>
    : O extends GWOFileTypesFalse
    ? Set<string>
    : O extends GWOFileTypesUnset
    ? Set<string>
    : Set<Path | string>

  constructor(patterns: Pattern[], path: Path, opts: O) {
    super(patterns, path, opts)
    this.matches = new Set() as Matches<O>
  }

  matchEmit(e: Result<O>): void
  matchEmit(e: Path | string): void {
    this.matches.add(e)
  }

  async walk(): Promise<Matches<O>> {
    if (this.signal?.aborted) throw this.signal.reason
    const t = this.path.isUnknown() ? await this.path.lstat() : this.path
    if (t) {
      await new Promise((res, rej) => {
        this.walkCB(t, this.patterns, () => {
          if (this.signal?.aborted) {
            rej(this.signal.reason)
          } else {
            res(this.matches)
          }
        })
      })
    }
    return this.matches
  }

  walkSync(): Matches<O> {
    if (this.signal?.aborted) throw this.signal.reason
    const t = this.path.isUnknown() ? this.path.lstatSync() : this.path
    // nothing for the callback to do, because this never pauses
    if (t) {
      this.walkCBSync(t, this.patterns, () => {
        if (this.signal?.aborted) throw this.signal.reason
      })
    }
    return this.matches
  }
}

export class GlobStream<
  O extends GlobWalkerOpts = GlobWalkerOpts
> extends GlobUtil<O> {
  results: O extends GWOFileTypesTrue
    ? Minipass<Path, Path>
    : O extends GWOFileTypesFalse
    ? Minipass<string, string>
    : O extends GWOFileTypesUnset
    ? Minipass<string, string>
    : Minipass<Path | string, Path | string>

  constructor(patterns: Pattern[], path: Path, opts: O) {
    super(patterns, path, opts)
    this.results = new Minipass({
      signal: this.signal,
      objectMode: true,
    }) as MatchStream<O>
    this.results.on('drain', () => this.resume())
    this.results.on('resume', () => this.resume())
  }

  matchEmit(e: Result<O>): void
  matchEmit(e: Path | string): void {
    this.results.write(e)
    if (!this.results.flowing) this.pause()
  }

  stream(): MatchStream<O> {
    const target = this.path
    if (target.isUnknown()) {
      target.lstat().then(e => {
        if (e) {
          this.walkCB(target, this.patterns, () => this.results.end())
        } else {
          this.results.end()
        }
      })
    } else {
      this.walkCB(target, this.patterns, () => this.results.end())
    }
    return this.results
  }

  streamSync(): MatchStream<O> {
    const target = this.path.isUnknown()
      ? this.path.lstatSync()
      : this.path
    if (target) {
      this.walkCBSync(target, this.patterns, () => this.results.end())
    } else {
      this.results.end()
    }
    return this.results
  }
}
