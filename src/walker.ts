/**
 * Single-use utility classes to provide functionality to the {@link Glob}
 * methods.
 *
 * @module
 */
import { Minipass } from 'minipass'
import { Path } from 'path-scurry'
import { Ignore, IgnoreLike } from './ignore.js'

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
  dotRelative?: boolean
  follow?: boolean
  ignore?: string | string[] | IgnoreLike
  mark?: boolean
  matchBase?: boolean
  // Note: maxDepth here means "maximum actual Path.depth()",
  // not "maximum depth beyond cwd"
  maxDepth?: number
  nobrace?: boolean
  nocase?: boolean
  nodir?: boolean
  noext?: boolean
  noglobstar?: boolean
  platform?: NodeJS.Platform
  posix?: boolean
  realpath?: boolean
  root?: string
  stat?: boolean
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
  ignore: string | string[] | IgnoreLike,
  opts: GlobWalkerOpts
): IgnoreLike =>
  typeof ignore === 'string'
    ? new Ignore([ignore], opts)
    : Array.isArray(ignore)
    ? new Ignore(ignore, opts)
    : ignore

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
  #ignore?: IgnoreLike
  #sep: '\\' | '/'
  signal?: AbortSignal
  maxDepth: number

  constructor(patterns: Pattern[], path: Path, opts: O)
  constructor(patterns: Pattern[], path: Path, opts: O) {
    this.patterns = patterns
    this.path = path
    this.opts = opts
    this.#sep = !opts.posix && opts.platform === 'win32' ? '\\' : '/'
    if (opts.ignore) {
      this.#ignore = makeIgnore(opts.ignore, opts)
    }
    // ignore, always set with maxDepth, but it's optional on the
    // GlobOptions type
    /* c8 ignore start */
    this.maxDepth = opts.maxDepth || Infinity
    /* c8 ignore stop */
    if (opts.signal) {
      this.signal = opts.signal
      this.signal.addEventListener('abort', () => {
        this.#onResume.length = 0
      })
    }
  }

  #ignored(path: Path): boolean {
    return this.seen.has(path) || !!this.#ignore?.ignored?.(path)
  }
  #childrenIgnored(path: Path): boolean {
    return !!this.#ignore?.childrenIgnored?.(path)
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
    const needStat = e.isUnknown() || this.opts.stat
    const s = needStat ? await e.lstat() : e
    if (this.opts.follow && this.opts.nodir && s?.isSymbolicLink()) {
      const target = await s.realpath()
      /* c8 ignore start */
      if (target && (target.isUnknown() || this.opts.stat)) {
        await target.lstat()
      }
      /* c8 ignore stop */
    }
    return this.matchCheckTest(s, ifDir)
  }

  matchCheckTest(e: Path | undefined, ifDir: boolean): Path | undefined {
    return e &&
      (this.maxDepth === Infinity || e.depth() <= this.maxDepth) &&
      (!ifDir || e.canReaddir()) &&
      (!this.opts.nodir || !e.isDirectory()) &&
      (!this.opts.nodir ||
        !this.opts.follow ||
        !e.isSymbolicLink() ||
        !e.realpathCached()?.isDirectory()) &&
      !this.#ignored(e)
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
    const needStat = e.isUnknown() || this.opts.stat
    const s = needStat ? e.lstatSync() : e
    if (this.opts.follow && this.opts.nodir && s?.isSymbolicLink()) {
      const target = s.realpathSync()
      if (target && (target?.isUnknown() || this.opts.stat)) {
        target.lstatSync()
      }
    }
    return this.matchCheckTest(s, ifDir)
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
      const abs = this.opts.posix ? e.fullpathPosix() : e.fullpath()
      this.matchEmit(abs + mark)
    } else {
      const rel = this.opts.posix ? e.relativePosix() : e.relative()
      const pre =
        this.opts.dotRelative && !rel.startsWith('..' + this.#sep)
          ? '.' + this.#sep
          : ''
      this.matchEmit(!rel ? '.' + mark : pre + rel + mark)
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
      if (this.maxDepth !== Infinity && t.depth() >= this.maxDepth) {
        continue
      }
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
      if (this.maxDepth !== Infinity && t.depth() >= this.maxDepth) {
        continue
      }
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
    if (this.path.isUnknown()) {
      await this.path.lstat()
    }
    await new Promise((res, rej) => {
      this.walkCB(this.path, this.patterns, () => {
        if (this.signal?.aborted) {
          rej(this.signal.reason)
        } else {
          res(this.matches)
        }
      })
    })
    return this.matches
  }

  walkSync(): Matches<O> {
    if (this.signal?.aborted) throw this.signal.reason
    if (this.path.isUnknown()) {
      this.path.lstatSync()
    }
    // nothing for the callback to do, because this never pauses
    this.walkCBSync(this.path, this.patterns, () => {
      if (this.signal?.aborted) throw this.signal.reason
    })
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
      target.lstat().then(() => {
        this.walkCB(target, this.patterns, () => this.results.end())
      })
    } else {
      this.walkCB(target, this.patterns, () => this.results.end())
    }
    return this.results
  }

  streamSync(): MatchStream<O> {
    if (this.path.isUnknown()) {
      this.path.lstatSync()
    }
    this.walkCBSync(this.path, this.patterns, () => this.results.end())
    return this.results
  }
}
