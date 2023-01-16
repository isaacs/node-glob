// this is a caching readdir that cuts down on excess syscalls,
// if the same directory needs to be read multiple times.

import { Dirent } from 'fs'

import { readdir as origReaddir, readdirSync as origReaddirSync } from 'fs'
import { basename, dirname, resolve } from 'path'

// when we read a directory, put its entries in here as well
export interface GlobCache {
  [path: string]: Dirent[] | NodeJS.ErrnoException
}

export class Readdir {
  cache: GlobCache

  constructor(cache: GlobCache = Object.create(null)) {
    this.cache = cache
  }

  // alias cached lookup from p to realpath rp, if not already set
  alias(rp: string, p: string): void {
    if (!this.cache[rp]) {
      this.cache[rp] = this.cache[p]
    }
  }

  // look up the Dirent for the path, if it exists
  lookup(path: string): Dirent | undefined {
    const resolved = resolve(path)
    const dir = dirname(resolved)
    const entities = this.cache[dir]
    if (entities && Array.isArray(entities)) {
      return entities.find(e => e.name === basename(resolved))
    }
  }

  isDirectory(path: string): boolean {
    const resolved = resolve(path)
    return this.cache[resolved]
      ? Array.isArray(this.cache[resolved])
      : !!this.lookup(path)?.isDirectory()
  }

  async readdir(path: string): Promise<Dirent[]> {
    const resolved = resolve(path)
    const cacheEntry = this.cache[resolved]
    if (cacheEntry) {
      if (Array.isArray(cacheEntry)) {
        return cacheEntry
      } else {
        throw cacheEntry
      }
    }

    return new Promise<Dirent[]>((res, rej) => {
      origReaddir(resolved, { withFileTypes: true }, (er, entities) => {
        this.cache[resolved] = er || entities
        if (er) {
          rej(er)
        } else {
          res(entities)
        }
      })
    })
  }

  readdirSync(path: string): Dirent[] {
    const resolved = resolve(path)
    const cacheEntry = this.cache[resolved]
    if (cacheEntry) {
      if (Array.isArray(cacheEntry)) {
        return cacheEntry
      } else {
        throw cacheEntry
      }
    }
    try {
      const entities = origReaddirSync(resolved, { withFileTypes: true })
      this.cache[resolved] = entities
      return entities
    } catch (er) {
      this.cache[resolved] = er as NodeJS.ErrnoException
      throw er
    }
  }
}
