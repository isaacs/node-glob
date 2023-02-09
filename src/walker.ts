import type { Path } from 'path-scurry'

// a single minimatch set entry with 1 or more parts
import { Pattern } from './pattern.js'

// the "matches" set is a set of either:
// - Path objects (if withFileTypes:true)
// - resolved paths (if absolute:true)
// - real paths (if realpath:true)
// - built-up path strings (all other cases)

// get the Path objects that match the pattern
export class GlobWalker {
  path: Path
  pattern: Pattern
  matches: Set<Path>

  constructor(
    pattern: Pattern,
    path: Path,
    matches: Set<Path> = new Set()
  ) {
    this.pattern = pattern
    this.path = path
    this.matches = matches
  }

  async walk(): Promise<Set<Path>> {
    // consume all pattern portions except the last one.
    // if the last one is a string, then we stat and add it.
    const promises: Promise<void>[] = []
    while (this.pattern.hasMore()) {
      const p = this.pattern.pattern()
      if (typeof p === 'string') {
        this.pattern.shift()
        this.path = this.path.child(p)
      } else if (p instanceof RegExp) {
        // this fans out, but we must match the pattern against
        // something, so nothing else to do here.
        promises.push(this.walkRegExp(p, this.pattern))
        await Promise.all(promises)
        return this.matches
      } else {
        // globstar!
        // this fans out, but also continues without the **
        promises.push(this.walkGlobStar(this.pattern))
        this.pattern.shift()
      }
    }
    const p = this.pattern.pattern()
    if (typeof p === 'string') {
      this.path = this.path.child(p)
      this.maybeMatchPath(promises)
    } else if (p instanceof RegExp) {
      promises.push(this.walkRegExp(p, this.pattern))
    } else {
      // globstar at the end is either nothing, or all children
      // make sure our path actually exists, if it was something
      // like a/b/** we might've got here without checking
      this.maybeMatchPath(promises)
      promises.push(this.walkGlobStar(this.pattern))
    }
    await Promise.all(promises)
    return this.matches
  }

  walkSync(): Set<Path> {
    // consume all pattern portions except the last one.
    // if the last one is a string, then we stat and add it.
    while (this.pattern.hasMore()) {
      const p = this.pattern.pattern()
      if (typeof p === 'string') {
        this.path = this.path.child(p)
        this.pattern.shift()
      } else if (p instanceof RegExp) {
        // this fans out, but we must match the pattern against
        // something, so nothing else to do here.
        this.walkRegExpSync(p, this.pattern)
        this.pattern.shift()
        return this.matches
      } else {
        // globstar!
        // this fans out, but also continues without the **
        this.walkGlobStarSync(this.pattern)
        this.pattern.shift()
      }
    }
    const p = this.pattern.pattern()
    if (typeof p === 'string') {
      this.path = this.path.child(p)
      this.maybeMatchPathSync()
    } else if (p instanceof RegExp) {
      this.walkRegExpSync(p, this.pattern)
      return this.matches
    } else {
      // globstar at the end is either nothing, or all children
      // make sure our path actually exists, if it was something
      // like a/b/** we might've got here without checking
      this.maybeMatchPathSync()
      this.walkGlobStarSync(this.pattern)
    }
    return this.matches
  }

  maybeMatchPath(promises: Promise<void>[]) {
    if (this.path.isUnknown()) {
      const lsc = this.path.lstatCached()
      if (lsc) {
        this.matches.add(lsc)
      } else {
        promises.push(
          this.path.lstat().then(p => {
            if (p) this.matches.add(p)
          })
        )
      }
    } else {
      this.matches.add(this.path)
    }
  }
  maybeMatchPathSync() {
    if (this.path.isUnknown()) {
      const lsc = this.path.lstatCached()
      if (lsc) {
        this.matches.add(lsc)
      } else {
        const p = this.path.lstatSync()
        if (p) this.matches.add(p)
      }
    } else {
      this.matches.add(this.path)
    }
  }

  async walkGlobStar(pattern: Pattern): Promise<void> {
    // get all children, and walk from there
    if (!this.path.canReaddir()) {
      return
    }
    return new Promise<void>(res => {
      this.path.readdirCB((_er, entries) => {
        Promise.all(
          entries.map(async (e: Path) => {
            if (e.name.startsWith('.')) return
            if (e.isSymbolicLink()) {
              // we can MATCH a symlink, just not traverse it
              this.matches.add(e)
              return
            }
            const w = new GlobWalker(pattern.copy(), e, this.matches)
            return w.walk()
          })
        ).then(() => res)
      }, true)
    })
  }

  walkGlobStarSync(pattern: Pattern): void {
    // get all children, and walk from there
    if (!this.path.canReaddir()) {
      return
    }
    const entries = this.path.readdirSync()
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      if (e.isSymbolicLink()) {
        // we can MATCH a symlink, just not traverse it
        this.matches.add(e)
        continue
      }
      const w = new GlobWalker(pattern.copy(), e, this.matches)
      w.walkSync()
    }
  }

  async walkRegExp(p: RegExp, pattern: Pattern): Promise<void> {
    if (!this.path.canReaddir()) {
      return
    }
    return new Promise<void>(res => {
      this.path.readdirCB((_, entries) => {
        if (!pattern.hasMore()) {
          for (const e of entries) {
            if (p.test(e.name)) this.matches.add(e)
          }
          res()
        } else {
          const promises: Promise<void>[] = []
          for (const e of entries) {
            if (p.test(e.name)) {
              const w = new GlobWalker(
                pattern.rest() as Pattern,
                e,
                this.matches
              )
              promises.push(w.walk().then(() => {}))
            }
          }
          Promise.all(promises).then(() => res())
        }
      }, true)
    })
  }

  walkRegExpSync(p: RegExp, pattern: Pattern): void {
    if (!this.path.canReaddir()) {
      return
    }
    const entries = this.path.readdirSync()
    if (!pattern.hasMore()) {
      for (const e of entries) {
        if (p.test(e.name)) this.matches.add(e)
      }
    } else {
      for (const e of entries) {
        if (p.test(e.name)) {
          const w = new GlobWalker(
            pattern.rest() as Pattern,
            e,
            this.matches
          )
          w.walkSync()
        }
      }
    }
  }
}
