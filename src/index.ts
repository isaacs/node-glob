import Minipass from 'minipass'
import { Glob, GlobOptions } from './glob.js'

export const globStreamSync = (
  pattern: string | string[],
  options: GlobOptions = {}
): Minipass<string> =>
  new Glob(pattern, { ...options, withFileTypes: false }).streamSync()

export const globStream = Object.assign(
  (
    pattern: string | string[],
    options: GlobOptions = {}
  ): Minipass<string> =>
    new Glob(pattern, { ...options, withFileTypes: false }).stream(),
  { sync: globStreamSync }
)

export const globSync = Object.assign(
  (pattern: string | string[], options: GlobOptions = {}): string[] =>
    new Glob(pattern, { ...options, withFileTypes: false }).walkSync(),
  { stream: globStreamSync }
)

export const glob = Object.assign(
  async (
    pattern: string | string[],
    options: GlobOptions = {}
  ): Promise<string[]> =>
    new Glob(pattern, { ...options, withFileTypes: false }).walk(),
  {
    sync: globSync,
    globSync,
    stream: globStream,
    streamSync: globStreamSync,
    globStream,
    globStreamSync,
    Glob,
  }
)

/* c8 ignore start */
export { Glob } from './glob.js'
export type { GlobOptions } from './glob.js'
export default glob
/* c8 ignore stop */
