/**
 * Single-use utility classes to provide functionality to the {@link Glob}
 * methods.
 *
 * @module
 */
import { Minipass } from 'minipass'
import type { Path } from 'path-scurry'
import type { IgnoreLike } from './ignore.js'
import { Ignore } from './ignore.js'

// XXX can we somehow make it so that it NEVER processes a given path more than
// once, enough that the match set tracking is no longer needed?  that'd speed
// things up a lot.  Or maybe bring back nounique, and skip it in that case?

// a single minimatch set entry with 1 or more parts
import type { Pattern } from './pattern.js'
import { Processor } from './processor.js'

export interface GlobWalkerOpts {
  absolute?: boolean
  allowWindowsEscape?: boolean
  cwd?: string | URL
  dot?: boolean
  dotRelative?: boolean
  follow?: boolean
  concurrency?: number
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
  includeChildMatches?: boolean
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

export type Result<O extends GlobWalkerOpts> =
  O extends GWOFileTypesTrue ? Path
  : O extends GWOFileTypesFalse ? string
  : O extends GWOFileTypesUnset ? string
  : Path | string

export type Matches<O extends GlobWalkerOpts> =
  O extends GWOFileTypesTrue ? Set<Path>
  : O extends GWOFileTypesFalse ? Set<string>
  : O extends GWOFileTypesUnset ? Set<string>
  : Set<Path | string>

export type MatchStream<O extends GlobWalkerOpts> = Minipass<
  Result<O>,
  Result<O>
>

const makeIgnore = (
  ignore: string | string[] | IgnoreLike,
  opts: GlobWalkerOpts,
): IgnoreLike =>
  typeof ignore === 'string' ? new Ignore([ignore], opts)
  : Array.isArray(ignore) ? new Ignore(ignore, opts)
  : ignore

type PendingRead = {
  run: () => void
  skip: () => void
}

class AsyncReadLimiter {
  readonly concurrency: number
  #inFlight: number = 0
  #pending: PendingRead[] = []
  #signal?: AbortSignal

  constructor(concurrency: number, signal?: AbortSignal) {
    this.concurrency = concurrency
    this.#signal = signal
    /* c8 ignore start */
    this.#signal?.addEventListener('abort', () => {
      const pending = this.#pending.splice(0)
      for (const item of pending) {
        item.skip()
      }
    })
    /* c8 ignore stop */
  }

  schedule(run: () => void, skip: () => void) {
    /* c8 ignore start */
    if (this.#signal?.aborted) {
      skip()
      return
    }
    /* c8 ignore stop */

    if (this.#inFlight < this.concurrency) {
      this.#inFlight++
      run()
      return
    }

    this.#pending.push({ run, skip })
  }

  done() {
    this.#inFlight--
    while (this.#inFlight < this.concurrency) {
      const next = this.#pending.shift()
      if (!next) {
        return
      }

      /* c8 ignore start */
      if (this.#signal?.aborted) {
        next.skip()
        continue
      }
      /* c8 ignore stop */

      this.#inFlight++
      next.run()
    }
  }
}

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
  #onResume: (() => unknown)[] = []
  #ignore?: IgnoreLike
  #sep: '\\' | '/'
  #readdirLimiter?: AsyncReadLimiter
  signal?: AbortSignal
  maxDepth: number
  includeChildMatches: boolean

  constructor(patterns: Pattern[], path: Path, opts: O)
  constructor(patterns: Pattern[], path: Path, opts: O) {
    this.patterns = patterns
    this.path = path
    this.opts = opts
    this.#sep = !opts.posix && opts.platform === 'win32' ? '\\' : '/'
    this.includeChildMatches = opts.includeChildMatches !== false
    if (opts.ignore || !this.includeChildMatches) {
      this.#ignore = makeIgnore(opts.ignore ?? [], opts)
      if (
        !this.includeChildMatches &&
        typeof this.#ignore.add !== 'function'
      ) {
        const m = 'cannot ignore child matches, ignore lacks add() method.'
        throw new Error(m)
      }
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
    let fn: (() => unknown) | undefined = undefined
    while (!this.paused && (fn = this.#onResume.shift())) {
      fn()
    }
  }
  onResume(fn: () => unknown) {
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
  async matchCheck(
    inPath: Path,
    ifDir: boolean,
  ): Promise<Path | undefined> {
    if (ifDir && this.opts.nodir) return undefined
    let rpc: Path | undefined
    let e: Path
    if (this.opts.realpath) {
      rpc = inPath.realpathCached() || (await inPath.realpath())
      if (!rpc) return undefined
      e = rpc
    } else {
      e = inPath
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
    return (
        e &&
          (this.maxDepth === Infinity || e.depth() <= this.maxDepth) &&
          (!ifDir || e.canReaddir()) &&
          (!this.opts.nodir || !e.isDirectory()) &&
          (!this.opts.nodir ||
            !this.opts.follow ||
            !e.isSymbolicLink() ||
            !e.realpathCached()?.isDirectory()) &&
          !this.#ignored(e)
      ) ?
        e
      : undefined
  }

  matchCheckSync(inPath: Path, ifDir: boolean): Path | undefined {
    if (ifDir && this.opts.nodir) return undefined
    let rpc: Path | undefined
    let e: Path
    if (this.opts.realpath) {
      rpc = inPath.realpathCached() || inPath.realpathSync()
      if (!rpc) return undefined
      e = rpc
    } else {
      e = inPath
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
    // we know we have an ignore if this is false, but TS doesn't
    if (!this.includeChildMatches && this.#ignore?.add) {
      const ign = `${e.relativePosix()}/**`
      this.#ignore.add(ign)
    }
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
        this.opts.dotRelative && !rel.startsWith(`..${this.#sep}`) ?
          `.${this.#sep}`
        : ''
      this.matchEmit(!rel ? `.${mark}` : pre + rel + mark)
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

  walkCB(target: Path, patterns: Pattern[], cb: () => unknown) {
    /* c8 ignore start */
    if (this.signal?.aborted) cb()
    /* c8 ignore stop */
    this.walkCB2(target, patterns, new Processor(this.opts), cb)
  }

  walkCBWithConcurrency(
    target: Path,
    patterns: Pattern[],
    concurrency: number,
    cb: () => unknown,
  ) {
    if (this.signal?.aborted) return cb()
    this.#readdirLimiter = new AsyncReadLimiter(concurrency, this.signal)
    this.walkCB2WithConcurrency(
      target,
      patterns,
      new Processor(this.opts),
      cb,
    )
  }

  #queueReaddir(
    target: Path,
    processor: Processor,
    cb: () => unknown,
  ) {
    const limiter = this.#readdirLimiter
    /* c8 ignore start */
    if (!limiter) {
      throw new Error('bounded readdir limiter not initialized')
    }
    /* c8 ignore stop */

    limiter.schedule(
      () => {
        target.readdirCB(
          (_, entries) => {
            limiter.done()
            this.walkCB3WithConcurrency(target, entries, processor, cb)
          },
          true,
        )
      },
      cb,
    )
  }

  walkCB2WithConcurrency(
    target: Path,
    patterns: Pattern[],
    processor: Processor,
    cb: () => unknown,
  ) {
    if (this.#childrenIgnored(target)) return cb()
    /* c8 ignore next */
    if (this.signal?.aborted) return cb()
    /* c8 ignore start */
    if (this.paused) {
      this.onResume(() =>
        this.walkCB2WithConcurrency(target, patterns, processor, cb),
      )
      /* c8 ignore next */
      return
    }
    /* c8 ignore stop */
    processor.processPatterns(target, patterns)

    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      /* c8 ignore next */
      if (this.#ignored(m)) continue
      tasks++
      void this.match(m, absolute, ifDir).then(() => next())
    }

    for (const t of processor.subwalkTargets()) {
      if (this.maxDepth !== Infinity && t.depth() >= this.maxDepth) {
        /* c8 ignore next */
        continue
      }
      tasks++
      const childrenCached = t.readdirCached()
      if (t.calledReaddir()) {
        this.walkCB3WithConcurrency(t, childrenCached, processor, next)
      } else {
        this.#queueReaddir(t, processor, next)
      }
    }

    next()
  }

  walkCB3WithConcurrency(
    target: Path,
    entries: Path[],
    processorx: Processor,
    cb: () => unknown,
  ) {
    if (this.signal?.aborted) return cb()
    const proc = processorx.filterEntries(target, entries)

    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of proc.matches.entries()) {
      if (this.#ignored(m)) continue
      tasks++
      void this.match(m, absolute, ifDir).then(() => next())
    }
    for (const [target, patterns] of proc.subwalks.entries()) {
      tasks++
      this.walkCB2WithConcurrency(target, patterns, proc.child(), next)
    }

    next()
  }

  walkCB2(
    target: Path,
    patterns: Pattern[],
    processor: Processor,
    cb: () => unknown,
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
      void this.match(m, absolute, ifDir).then(() => next())
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
          true,
        )
      }
    }

    next()
  }

  walkCB3(
    target: Path,
    entries: Path[],
    processorx: Processor,
    cb: () => unknown,
  ) {
    const proc = processorx.filterEntries(target, entries)

    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of proc.matches.entries()) {
      if (this.#ignored(m)) continue
      tasks++
      void this.match(m, absolute, ifDir).then(() => next())
    }
    for (const [target, patterns] of proc.subwalks.entries()) {
      tasks++
      this.walkCB2(target, patterns, proc.child(), next)
    }

    next()
  }

  walkCBSync(target: Path, patterns: Pattern[], cb: () => unknown) {
    /* c8 ignore start */
    if (this.signal?.aborted) cb()
    /* c8 ignore stop */
    this.walkCB2Sync(target, patterns, new Processor(this.opts), cb)
  }

  walkCB2Sync(
    target: Path,
    patterns: Pattern[],
    processor: Processor,
    cb: () => unknown,
  ) {
    if (this.#childrenIgnored(target)) return cb()
    if (this.signal?.aborted) cb()
    if (this.paused) {
      this.onResume(() =>
        this.walkCB2Sync(target, patterns, processor, cb),
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
    cb: () => unknown,
  ) {
    const proc = processor.filterEntries(target, entries)

    let tasks = 1
    const next = () => {
      if (--tasks === 0) cb()
    }

    for (const [m, absolute, ifDir] of proc.matches.entries()) {
      if (this.#ignored(m)) continue
      this.matchSync(m, absolute, ifDir)
    }
    for (const [target, patterns] of proc.subwalks.entries()) {
      tasks++
      this.walkCB2Sync(target, patterns, proc.child(), next)
    }

    next()
  }
}

export class GlobWalker<
  O extends GlobWalkerOpts = GlobWalkerOpts,
> extends GlobUtil<O> {
  matches = new Set<Result<O>>()

  constructor(patterns: Pattern[], path: Path, opts: O) {
    super(patterns, path, opts)
  }

  matchEmit(e: Result<O>): void {
    this.matches.add(e)
  }

  async walk(): Promise<Set<Result<O>>> {
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

  async walkWithConcurrency(
    concurrency: number,
  ): Promise<Set<Result<O>>> {
    if (this.signal?.aborted) throw this.signal.reason
    if (this.path.isUnknown()) {
      await this.path.lstat()
    }
    await new Promise((res, rej) => {
      this.walkCBWithConcurrency(
        this.path,
        this.patterns,
        concurrency,
        () => {
          if (this.signal?.aborted) {
            rej(this.signal.reason)
          } else {
            res(this.matches)
          }
        },
      )
    })
    return this.matches
  }

  walkSync(): Set<Result<O>> {
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
  O extends GlobWalkerOpts = GlobWalkerOpts,
> extends GlobUtil<O> {
  results: Minipass<Result<O>, Result<O>>

  constructor(patterns: Pattern[], path: Path, opts: O) {
    super(patterns, path, opts)
    this.results = new Minipass<Result<O>, Result<O>>({
      signal: this.signal,
      objectMode: true,
    })
    this.results.on('drain', () => this.resume())
    this.results.on('resume', () => this.resume())
  }

  matchEmit(e: Result<O>): void {
    this.results.write(e)
    if (!this.results.flowing) this.pause()
  }

  stream(): MatchStream<O> {
    const target = this.path
    if (target.isUnknown()) {
      void target.lstat().then(() => {
        this.walkCB(target, this.patterns, () => this.results.end())
      })
    } else {
      this.walkCB(target, this.patterns, () => this.results.end())
    }
    return this.results
  }

  streamWithConcurrency(concurrency: number): MatchStream<O> {
    const target = this.path
    if (target.isUnknown()) {
      void target.lstat().then(() => {
        this.walkCBWithConcurrency(
          target,
          this.patterns,
          concurrency,
          () => this.results.end(),
        )
      })
    } else {
      this.walkCBWithConcurrency(
        target,
        this.patterns,
        concurrency,
        () => this.results.end(),
      )
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
