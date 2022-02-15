// XXX use readdir with {withFileTypes:true} to skip a stat
// XXX use streaming fs.Dir reading rather than readdir(), to support
// folders containing very many entries.
//
// A Glob object is a readable Minipass stream
// there are three kinds of "process()" calls:
// - top level initial process (one for each minimatch set)
// - simple process (only strings left in the pattern)
// - readdir process (next pattern part is not a globstar)
// - globstar process (next pattern part is a globstar)
// All of these route eventually through this.processStep(p, index, inGlobStar)
//
// As long as we're flowing, keep processing.  Any time super.write(match)
// returns false, pause the processing.

const Minipass = require('minipass')
const { GLOBSTAR, Minimatch } = require('minimatch')
const fs = require('fs')
const { join, resolve, isAbsolute } = require('path')
const isWindows = require('./lib/is-windows.js')
const rp = require('fs.realpath')

const alphasort = (a, b) => a.localeCompare(b, 'en')

const glob = (pattern, options = {}) => {
  const g = new Glob(pattern, options)
  const p = g.results
  p.abort = () => g.abort()
  return p
}

const globSync = (pattern, options = {}) =>
  new GlobSync(pattern, options).results

const hasMagic = (pattern, options = {}) => {
  const g = new Glob(pattern, options)
  if (!pattern) {
    return false
  }
  const set = g.minimatch.set
  if (set.length > 1) {
    return true
  }
  for (const p of set) {
    for (const pp of p) {
      if (typeof pp !== 'string') {
        return true
      }
    }
  }
  return false
}

class Glob extends Minipass {
  constructor (pattern, options = {}) {
    if (!options || typeof options !== 'object') {
      throw new TypeError('options must be an object if specified')
    }
    if (typeof pattern !== 'string') {
      throw new TypeError('glob pattern must be a string')
    }
    super({ objectMode: true })
    this.readable = true
    this.writable = false

    this.options = options
    if (options.matchBase && !pattern.includes('/')) {
      if (options.noglobstar) {
        throw new Error('base matching requires globstar')
      }
      pattern = `**/${pattern}`
    }
    this.silent = !!options.silent
    this.pattern = pattern
    this.strict = options.strict !== false
    this.realpath = !!options.realpath
    this.realpathCache = options.realpathCache || Object.create(null)
    this.follow = !!options.follow
    this.dot = !!options.dot
    this.nodir = !!options.nodir
    this.mark = this.nodir || !!options.mark
    this.nounique = !!options.nounique
    this.nonull = !!options.nonull
    this.nosort = !!options.nosort
    this.stat = !!options.stat
    this.nocase = !!options.nocase
    this.absolute = !!options.absolute
    this.fs = options.fs || fs
    this.maxLength = options.maxLength || Infinity
    this.cache = options.cache || new Map()
    this.statCache = options.statCache || Object.create(null)
    this.symlinks = options.symlinks || new Map()
    this.absCache = options.absCache || Object.create(null)

    this.statInflight = options.statInflight || new Map()
    this.readdirInflight = options.readdirInflight || new Map()
    this.lstatInflight = options.lstatInflight || new Map()

    this.ignore = options.ignore || []
    if (!Array.isArray(this.ignore)) {
      this.ignore = [ this.ignore ]
    }
    if (this.ignore.length) {
      this.ignore = this.ignore.map(ignoreMap)
    }

    const cwd = process.cwd()
    this.cwd = typeof options.cwd === 'string' ? resolve(options.cwd) : cwd
    this.changedCwd = this.cwd !== cwd

    this.root = resolve(options.root || resolve(this.cwd, '/'))
    if (isWindows) {
      this.root = this.root.replace(/\\/g, '/')
    }
    if (isWindows) {
      this.cwd = this.cwd.replace(/\\/g, '/')
    }
    this.nomount = !!options.nomount

    this.options.nonegate = true
    this.options.nocomment = true
    this.options.allowWindowsEscape = true

    this.minimatch = new Minimatch(pattern, this.options)

    this.matches = this.minimatch.set.map(() => Object.create(null))
    this.uniqueMatches = Object.create(null)
    this.processing = 0
    this.inProcessLoop = false
    this.processQueue = this.minimatch.set.map((p, i) => [p, i, false])
    this.finishing = false
  }

  get results () {
    return new Promise(async (res, rej) => {
      this.on('error', rej)
      this.resume()
      await this.promise().catch(() => {})
      Object.defineProperty(this, 'results', {
        value: Promise.resolve(this.found),
      })
      res(this.found)
    })
  }

  async inflight (cache, key, fn) {
    if (this.destroyed) {
      return
    }
    if (cache.has(key)) {
      return cache.get(key)
    }
    const p = fn().then(p => {
      cache.set(key, p)
      return p
    })
    cache.set(key, p)
    return p
  }

  makeAbs (f) {
    if (this.absCache[f]) {
      return this.absCache[f]
    }
    const abs_ = f.charAt(0) === '/' ? join(this.root, f)
      : isAbsolute(f) || f === '' ? f
      : this.changedCwd ? resolve(this.cwd, f)
      : resolve(f)
    const abs = isWindows ? abs_.replace(/\\/g, '/') : abs_
    this.absCache[f] = abs
    return abs
  }

  write () {
    throw new Error('glob is a readable stream only')
  }
  end () {
    throw new Error('glob is a readable stream only')
  }
  on (ev, fn) {
    const ret = super.on(ev, fn)
    this.process()
    return ret
  }
  resume () {
    super.resume()
    this.process()
  }
  emit (ev, ...data) {
    const ret = super.emit(ev, ...data)
    this.process()
    return ret
  }

  process () {
    if (this.destroyed) {
      return
    }
    if (this.inProcessLoop) {
      return
    }
    this.inProcessLoop = true
    while (this.flowing && this.processQueue.length) {
      const pq = this.processQueue.shift()
      if (pq) {
        const [pattern, index, inGlobStar] = pq
        this.processStep(pattern, index, inGlobStar)
      }
    }

    if (this.processing === 0 && this.processQueue.length === 0) {
      this.realpath ? this.doRealpath() : this.finish()
    }
    this.inProcessLoop = false
  }

  async doRealpath () {
    if (this.destroyed) {
      return
    }
    const promises = []
    for (let i = 0; i < this.matches.length; i++) {
      promises.push(this.realpathSet(i))
    }
    await Promise.all(promises)
    return this.finish()
  }

  async realpathSet (index) {
    if (this.destroyed) {
      return
    }
    const matchset = this.matches[index]
    const found = Object.keys(matchset)
    const n = found.length
    if (n === 0) {
      return
    }
    const set = this.matches[index] = Object.create(null)
    const promises = []
    for (const p of found) {
      const r = this.makeAbs(p)
      promises.push(this.realpathOne(r, set))
    }
    await Promise.all(promises)
    this.matches[index] = set
  }

  async realpathOne (p, set) {
    if (this.destroyed) {
      return
    }
    return new Promise(res => {
      rp.realpath(p, this.realpathCache, (er, real) => {
        if (!er) {
          set[real] = true
        } else if (er.syscall === 'stat' || er.syscall === 'lstat') {
          set[p] = true
        } else {
          this.emit('error', er)
        }
        res()
      })
    })
  }

  processStep (pattern, index, inGlobStar) {
    if (this.destroyed) {
      return
    }
    if (this.processing && !this.flowing) {
      this.processQueue.push([pattern, index, inGlobStar])
      return
    }
    this.processing ++
    const [prefix, read, abs, remain] = this.getProcessDetails(pattern, index)
    if (!read && !abs && !remain) {
      return this.processSimple(prefix, index)
    }

    if (this.childrenIgnored(read)) {
      this.processing --
      return
    }

    const isGlobStar = remain[0] === GLOBSTAR
    if (isGlobStar) {
      this.processGlobStar(prefix, read, abs, remain, index, inGlobStar)
    } else {
      this.processReaddir(prefix, read, abs, remain, index, inGlobStar)
    }
    if (!this.inProcessLoop) {
      this.process()
    }
  }

  async processSimple (prefix, index) {
    if (this.destroyed) {
      return
    }
    const st = await this.doStat(prefix)
    const abs = this.makeAbs(prefix)
    const exists = st !== false && this.cache.get(abs) !== false ||
      this.symlinks.get(abs)
    this.processSimple2(prefix, index, exists)
  }
  processSimple2 (prefix, index, exists) {
    if (this.destroyed) {
      return
    }
    if (exists) {
      if (prefix && isAbsolute(prefix) && !this.nomount) {
        const trail = /[\/\\]$/.test(prefix)
        if (prefix.charAt(0) === '/') {
          prefix = join(this.root, prefix)
        } else {
          prefix = resolve(this.root, prefix)
          if (trail) {
            prefix += '/'
          }
        }
      }

      if (isWindows) {
        prefix = prefix.replace(/\\/g, '/')
      }
      this.emitMatch(index, prefix)
    }
    this.processing --
    this.process()
  }

  abort () {
    this.destroy()
    this.emit('abort')
  }

  emitMatch (index, e) {
    if (this.destroyed) {
      return
    }
    if (this.isIgnored(e)) {
      return
    }
    const abs = isAbsolute(e) ? e : this.makeAbs(e)
    if (this.mark) {
      e = this.markMatch(e)
    }
    if (this.absolute) {
      e = abs
    }
    if (this.matches[index][e]) {
      return
    }
    if (this.nodir) {
      const c = this.cache.get(abs)
      if (c === 'DIR' || Array.isArray(c)) {
        return
      }
    }

    this.matches[index][e] = true
    if (this.uniqueMatches[e] && !this.nounique) {
      return
    }
    this.uniqueMatches[e] = true

    const st = this.statCache[abs]
    if (st) {
      this.emit('stat', e, st)
    }

    this.emit('match', e)
    if (super.write(e)) {
      this.process()
    }
  }

  async processGlobStar (prefix, read, abs, remain, index, inGlobStar) {
    if (this.destroyed) {
      return
    }
    const entries = await this.doReaddir(abs, inGlobStar)
    return this.processGlobStar2(prefix, read, abs, remain, index, inGlobStar, entries)
  }
  processGlobStar2 (prefix, read, abs, remain, index, inGlobStar, entries) {
    if (this.destroyed) {
      return
    }
    const checks = this.getGlobStarChecks(
      prefix, read, abs, remain, index, inGlobStar, entries)
    for (const [p, inGlobStar] of checks) {
      this.processStep(p, index, inGlobStar)
    }
    this.processing --
    this.process()
  }

  getGlobStarChecks (prefix, read, abs, remain, index, inGlobStar, entries) {
    if (!entries) {
      return []
    }
    const checks = []

    // test without the globstar, and with every child both below
    // and replacing the globstar.
    const remainWithoutGlobStar = remain.slice(1)
    const gspref = prefix ? [prefix] : []
    const noGlobStar = gspref.concat(remainWithoutGlobStar)

    checks.push([noGlobStar, false])

    const isSym = this.symlinks.get(abs)
    const len = entries.length

    // if it's a symlink, and we're in a globstar, then stop
    if (isSym && inGlobStar && !this.follow) {
      return checks
    }

    for (const e of entries) {
      if (e.charAt(0) === '.' && !this.dot) {
        continue
      }
      // this two cases enter the inGlobStar state
      const instead = gspref.concat(e, remainWithoutGlobStar)
      checks.push([instead, true])
      const below = gspref.concat(e, remain)
      checks.push([below, true])
    }

    return checks
  }

  // XXX use the new Dir handle streaming stuff, so we don't choke on
  // directories with a lot of entries.
  async processReaddir (prefix, read, abs, remain, index, inGlobStar) {
    if (this.destroyed) {
      return
    }
    const entries = await this.doReaddir(abs, inGlobStar)
    this.processReaddir2(prefix, read, abs, remain, index, inGlobStar, entries)
  }
  processReaddir2 (prefix, read, abs, remain, index, inGlobStar, entries) {
    if (this.destroyed) {
      return
    }
    const checks = this.getProcessReaddirChecks(
      prefix, read, abs, remain, index, inGlobStar, entries)
    for (const p of checks) {
      this.processStep(p, index, inGlobStar)
    }
    this.processing --
    this.process()
  }

  getProcessReaddirChecks (prefix, read, abs, remain, index, inGlobStar, entries) {
    if (!entries) {
      return []
    }

    // will only match dot entries if it starts with a dot, or if
    // dot is set.  Stuff like @(.foo|.bar) isn't allowed.
    const pn = remain[0]
    const negate = !!this.minimatch.negate
    const rawGlob = pn._glob
    const dotOk = this.dot || rawGlob.charAt(0) === '.'
    const matchedEntries = []
    for (const e of entries) {
      if (e.charAt(0) !== '.' || dotOk) {
        const m = negate && !prefix ? !pn.test(e) : pn.test(e)
        if (m) {
          matchedEntries.push(e)
        }
      }
    }

    const len = matchedEntries.length
    // if no matched entries, then nothing matches
    if (len === 0) {
      return []
    }

    // no need to stat again if we don't need to mark them.
    // readdir() returned them, we know they exist.
    if (remain.length === 1 && !this.mark && !this.stat) {
      for (let i = 0; i < len; i++) {
        let e = matchedEntries[i]
        if (prefix) {
          if (prefix !== '/') {
            e = prefix + '/' + e
          } else {
            e = prefix + e
          }
        }
        if (e.charAt(0) === '/' && !this.nomount) {
          e = join(this.root, e)
        }
        this.emitMatch(index, e)
      }
      return []
    }

    // now test all matched entries as stand-ins for that part of the pattern
    remain.shift()
    const checks = []
    for (let i = 0; i < len; i++) {
      let e = matchedEntries[i]
      if (prefix) {
        if (prefix !== '/') {
          e = prefix + '/' + e
        } else {
          e = prefix + e
        }
      }
      checks.push([e].concat(remain))
    }
    return checks
  }

  // returns [prefix, read, abs, remain]
  getProcessDetails (pattern, index) {
    let n = 0
    while (typeof pattern[n] === 'string') {
      n ++
    }

    let prefix
    switch (n) {
      // no magic in it.  just stat and be done
      case pattern.length:
        return [pattern.join('/'), null, null, null]

      case 0:
        // pattern *starts* with some non-trivial item
        // goign to readdir(cwd), but not include prefix in matches
        prefix = null
        break

      default:
        // pattern has some string bits in front.
        // whatever it starts with is the prefix
        prefix = pattern.slice(0, n).join('/')
        break
    }

    const remain = pattern.slice(n)
    let read
    if (prefix === null) {
      read = '.'
    } else if (isAbsolute(prefix) ||
        isAbsolute(pattern.map(p =>
          typeof p === 'string' ? p : '[*]').join('/'))) {
      if (!prefix || !isAbsolute(prefix)) {
        prefix = '/' + prefix
      }
      read = prefix
    } else {
      read = prefix
    }

    const abs = this.makeAbs(read)
    return [prefix, read, abs, remain]
  }

  doStat (f) {
    if (this.destroyed) {
      return
    }
    const abs = this.makeAbs(f)
    const needDir = f.slice(-1) === '/'
    if (f.length > this.maxLength) {
      return false
    }

    let c
    if (!this.stat && (c = this.cache.get(abs)) !== undefined) {
      if (Array.isArray(c)) {
        c = 'DIR'
      }
      if (!needDir || c === 'DIR') {
        return c
      }
      if (needDir && c === 'FILE') {
        return false
      }
    }

    // have to stat
    const stat = this.statCache[abs]
    if (stat === false) {
      return false
    }
    if (stat) {
      const type = stat.isDirectory() ? 'DIR' : 'FILE'
      if (needDir && type === 'FILE') {
        return false
      } else {
        return type
      }
    }

    return this.doStat2(f, abs)
  }

  async doStat2 (f, abs) {
    if (this.destroyed) {
      return
    }
    // if it's a symlink, then treat as the target, unless the
    // target does not exist, then treat as file.
    const lst = await this.doLstat(abs)
    if (!lst) {
      return
    }
    const [er, st] = !lst.isSymbolicLink() ? [undefined, lst]
      : await this.inflight(this.statInflight, abs, () => new Promise(res => {
          this.fs.stat(abs, (er, stat) => res([er, stat]))
        }))
    return this.doStat3(f, abs, er, st)
  }

  doStat3 (f, abs, er, st) {
    if (this.destroyed) {
      return
    }
    if (er && (er.code === 'ENOENT' || er.code === 'ENOTDIR')) {
      this.statCache[abs] = false
      // if it's a broken symlink, we treat that as a normal non-directory
      return this.symlinks.get(abs) ? 'FILE' : false
    }

    const needDir = f.slice(-1) === '/'
    this.statCache[abs] = st

    let c = !st ? true
      : st.isDirectory() ? 'DIR'
      : 'FILE'
    if (!this.cache.has(abs)) {
      this.cache.set(abs, c)
    }

    if (needDir && c === 'FILE') {
      return false
    }
    return c || true
  }

  async doReaddir (abs, inGlobStar) {
    if (this.destroyed) {
      return
    }
    if (inGlobStar && !this.symlinks.has(abs) && !this.follow) {
      return this.readdirInGlobStar(abs)
    }
    const c = this.cache.get(abs)
    if (c === false || c === 'FILE') {
      return []
    } else if (Array.isArray(c)) {
      return c
    }
    return this.inflight(this.readdirInflight, abs, () => new Promise(res => {
      this.fs.readdir(abs, (er, entries) => res(this.readdirCb(abs, er, entries)))
    }))
  }

  readdirCb (abs, er, entries) {
    if (this.destroyed) {
      return
    }
    return er ? this.readdirError(abs, er)
      : this.readdirEntries(abs, entries)
  }

  async doLstat (abs) {
    if (this.destroyed) {
      return
    }
    return this.inflight(this.lstatInflight, abs, () => new Promise(res => {
      this.fs.lstat(abs, (er, st) => {
        res(this.afterLstat(abs, er, st))
      })
    }))
  }

  afterLstat (abs, er, st) {
    if (this.destroyed) {
      return
    }
    if (er && (er.code === 'ENOENT' || er.code === 'ENOTDIR')) {
      this.cache.set(abs, false)
      return false
    }
    const isSym = st && st.isSymbolicLink()
    this.symlinks.set(abs, !!isSym)
    if (!isSym && st && !st.isDirectory()) {
      this.cache.set(abs, 'FILE')
    }
    return st
  }

  async readdirInGlobStar (abs) {
    if (this.destroyed) {
      return
    }
    const st = await this.doLstat(abs)
    if (this.symlinks.get(abs) || !st || st.isDirectory()) {
      return this.doReaddir(abs, false)
    }
  }

  readdirError (abs, er) {
    // handle errors, and cache the information
    switch (er.code) {
      case 'ENOTSUP': // https://github.com/isaacs/node-glob/issues/205
      case 'ENOTDIR': // totally normal. means it *does* exist.
        this.cache.set(abs, 'FILE')
        if (abs === this.cwd) {
          var error = new Error(er.code + ' invalid cwd ' + this.cwd)
          error.path = this.cwd
          error.code = er.code
          this.emit('error', error)
        }
        break

      case 'ENOENT': // not terribly unusual
      case 'ELOOP':
      case 'ENAMETOOLONG':
      case 'UNKNOWN':
        this.cache.set(abs, false)
        break

      default: // some unusual error.  Treat as failure.
        this.cache.set(abs, false)
        if (this.strict) {
          this.emit('error', er)
        }
        if (!this.silent) {
          console.error('glob error', er)
        }
        break
    }
    return []
  }

  readdirEntries (abs, entries) {
    if (!this.mark && !this.stat) {
      for (let e of entries) {
        if (abs === '/') {
          e = abs + e
        } else {
          e = abs + '/' + e
        }
        this.cache.set(e, true)
      }
    }
    this.cache.set(abs, entries)
    return entries
  }

  finish () {
    if (this.destroyed || this.finishing) {
      return
    }
    this.finishing = true
    let all = this.nounique ? [] : Object.create(null)
    for (let i = 0; i < this.matches.length; i++) {
      const matches = this.matches[i]
      if (!matches || Object.keys(matches).length === 0) {
        if (this.nonull) {
          const literal = this.minimatch.globSet[i]
          if (this.nounique) {
            all.push(literal)
          } else {
            all[literal] = true
          }
          this.emitMatch(i, literal)
        }
      } else {
        // had matches
        const m = Object.keys(matches)
        if (this.nounique) {
          all.push(...m)
        } else {
          for (const match of m) {
            all[match] = true
          }
        }
      }
    }
    if (!this.nounique) {
      all = Object.keys(all)
    }
    if (!this.nosort) {
      all = all.sort(alphasort)
    }
    if (this.mark) {
      for (let i = 0; i < all.length; i++) {
        all[i] = this.markMatch(all[i])
      }
      if (this.nodir) {
        all = all.filter(e => {
          let notDir = !(/\/$/.test(e))
          const c = this.cache.get(e) || this.cache.get(this.makeAbs(e))
          if (notDir && c) {
            notDir = c !== 'DIR' && !Array.isArray(c)
          }
          return notDir
        })
      }
    }
    if (this.ignore.length) {
      all = all.filter(m => !this.isIgnored(m))
    }
    // for (let i = 0; i < this.matches.length; i++) {
    //   console.error(this.minimatch.set[i].map(m => m._glob || m), Object.keys(this.matches[i]))
    // }
    this.found = all
    super.end()
  }

  isIgnored (path) {
    if (!this.ignore.length) {
      return false
    }

    return this.ignore.some(item =>
      item.matcher.match(path) ||
      !!(item.gmatcher && item.gmatcher.match(path))
    )
  }

  childrenIgnored (path) {
    if (!this.ignore.length) {
      return false
    }

    return this.ignore.some(item =>
      !!(item.gmatcher && item.gmatcher.match(path)))
  }

  markMatch (p) {
    const abs = this.makeAbs(p)
    const c = this.cache.get(abs)
    let m = p
    if (c) {
      const isDir = c === 'DIR' || Array.isArray(c)
      const slash = p.slice(-1) === '/'

      if (isDir && !slash) {
        m += '/'
      } else if (!isDir && slash) {
        m = m.slice(0, -1)
      }

      if (m !== p) {
        const mabs = this.makeAbs(m)
        this.statCache[mabs] = this.statCache[abs]
        this.cache.set(mabs, this.cache.get(abs))
      }
    }
    return m
  }
}

class GlobSync extends Glob {
  get results () {
    this.resume()
    Object.defineProperty(this, 'results', {
      get: () => this.found,
    })
    return this.found
  }
  inflight (cache, key, fn) {
    if (cache.has(key)) {
      return cache.get(key)
    }
    const p = fn()
    cache.set(key, p)
    return p
  }
  doRealpath () {
    for (let i = 0; i < this.matches.length; i++) {
      this.realpathSet(i)
    }
    return this.finish()
  }
  realpathSet (index) {
    const matchset = this.matches[index]
    const found = Object.keys(matchset)
    const n = found.length
    if (n === 0) {
      return
    }
    const set = this.matches[index] = Object.create(null)
    const promises = []
    for (const p of found) {
      const r = this.makeAbs(p)
      this.realpathOne(r, set)
    }
    this.matches[index] = set
  }
  realpathOne (p, set) {
    try {
      set[rp.realpathSync(p, this.realpathCache)] = true
    } catch (er) {
      if (er.syscall === 'stat' || er.syscall === 'lstat') {
        set[p] = true
      } else {
        this.emit('error', er)
      }
    }
  }
  processSimple (prefix, index) {
    if (this.destroyed) {
      return
    }
    const st = this.doStat(prefix)
    const abs = this.makeAbs(prefix)
    const exists = st !== false && this.cache.get(abs) !== false ||
      this.symlinks.get(abs)
    this.processSimple2(prefix, index, exists)
  }
  processGlobStar (prefix, read, abs, remain, index, inGlobStar) {
    if (this.destroyed) {
      return
    }
    const entries = this.doReaddir(abs, inGlobStar)
    return this.processGlobStar2(prefix, read, abs, remain, index, inGlobStar, entries)
  }
  processReaddir (prefix, read, abs, remain, index, inGlobStar) {
    if (this.destroyed) {
      return
    }
    const entries = this.doReaddir(abs, inGlobStar)
    this.processReaddir2(prefix, read, abs, remain, index, inGlobStar, entries)
  }
  doStat2 (f, abs) {
    // if it's a symlink, then treat as the target, unless the
    // target does not exist, then treat as file.
    const lst = this.doLstat(abs)
    if (!lst) {
      return
    }
    const [er, st] = !lst.isSymbolicLink() ? [undefined, lst]
      : this.inflight(this.statInflight, abs, () => {
          try {
            return [undefined, this.fs.statSync(abs)]
          } catch (er) {
            return [er, undefined]
          }
        })

    return this.doStat3(f, abs, er, st)
  }
  doReaddir (abs, inGlobStar) {
    if (inGlobStar && !this.symlinks.has(abs) && !this.follow) {
      return this.readdirInGlobStar(abs)
    }
    const c = this.cache.get(abs)
    if (c === false || c === 'FILE') {
      // console.error('FALSE OR FILE', abs, c)
      return []
    } else if (Array.isArray(c)) {
      // console.error('ARRAY CACHED', abs, c)
      return c
    }
    return this.inflight(this.readdirInflight, abs, () => {
      let entries, er
      try {
        entries = this.fs.readdirSync(abs)
      } catch (e) {
        er = e
      }
      return this.readdirCb(abs, er, entries)
    })
  }
  doLstat (abs) {
    return this.inflight(this.lstatInflight, abs, () => {
      let er, st
      try {
        st = this.fs.lstatSync(abs)
      } catch (e) {
        er = e
      }
      return this.afterLstat(abs, er, st)
    })
  }
  readdirInGlobStar (abs) {
    const st = this.doLstat(abs)
    if (this.symlinks.get(abs) || !st || st.isDirectory()) {
      return this.doReaddir(abs, false)
    }
  }
}

// ignore patterns are always in dot:true mode.
const ignoreMap = pattern => ({
  matcher: new Minimatch(pattern, { dot: true }),
  gmatcher: (pattern.slice(-3) === '/**')
    ? new Minimatch(pattern.replace(/(\/\*\*)+$/, ''), { dot: true })
    : null,
})


glob.hasMagic = hasMagic
glob.sync = globSync
glob.globSync = globSync
glob.glob = glob
glob.Glob = Glob
Glob.Sync = GlobSync
glob.GlobSync = GlobSync
globSync.GlobSync = GlobSync
module.exports = glob
