// this is a caching readdir that cuts down on excess syscalls,
// if the same directory needs to be read multiple times.

import { Dirent } from 'fs'

import {
  readdir as origReaddir,
  readdirSync as origReaddirSync,
  statSync,
} from 'fs'
import { basename, dirname, resolve } from 'path'

// when we read a directory, put its entries in here as well
export interface GlobCache {
  [path: string]: Dirent[] | false
}

export class Readdir {
  cache: GlobCache
  pcache: { [path: string]: Promise<Dirent[] | false> | undefined }

  constructor(cache: GlobCache = Object.create(null)) {
    this.pcache = Object.create(null)
    this.cache = cache
  }

  // look up the Dirent for the path, if it exists
  lookup(resolved: string): Dirent | undefined {
    const dir = dirname(resolved)
    const entities = this.cache[dir]
    if (entities && Array.isArray(entities)) {
      return entities.find(e => e.name === basename(resolved))
    }
  }

  isDirectory(path: string): boolean {
    const resolved = resolve(path)
    const cached = this.cache[resolved]
    return Array.isArray(cached)
      ? true
      : !!this.lookup(resolved)?.isDirectory()
  }

  async readdir(path: string): Promise<Dirent[] | false> {
    const cacheEntry = this.cache[path]
    if (cacheEntry !== undefined) {
      return cacheEntry
    }

    // const lu = this.lookup(path)
    // if (lu && !lu.isDirectory() && !lu.isSymbolicLink()) {
    //   return (this.cache[path] = false)
    // }

    const pc = this.pcache[path]
    if (pc) {
      return pc
    }

    return (this.pcache[path] = new Promise<Dirent[] | false>(res => {
      origReaddir(path, { withFileTypes: true }, (_, entities) => {
        this.pcache[path] = undefined
        res((this.cache[path] = entities || false))
      })
    }))
  }

  readdirSync(path: string): Dirent[] | false {
    // if (path.startsWith('//')) {
    //   console.error('WAT', path)
    // }
    const cacheEntry = this.cache[path]
    if (Array.isArray(cacheEntry) || cacheEntry === false) {
      return cacheEntry
    }

    // const lu = this.lookup(path)
    // if (lu && !lu.isDirectory() && !lu.isSymbolicLink()) {
    //   return (this.cache[path] = false)
    // }

    // try to avoid getting an error object created if we can
    // stack traces are expensive, and we don't use them.
    try {
      const st = statSync(path, { throwIfNoEntry: false })
      if (!st || !st.isDirectory()) {
        return (this.cache[path] = false)
      }
      return (this.cache[path] = origReaddirSync(path, {
        withFileTypes: true,
      }))
    } catch (_) {
      return (this.cache[path] = false)
    }
  }
}
