import { Glob, GlobOptions } from './glob.js'
import { hasMagic } from './has-magic.js'

export const globSync = (
  pattern: string | string[],
  options?: Glob | GlobOptions
): string[] => new Glob(pattern, options).processSync()

export const glob = Object.assign(
  async (
    pattern: string | string[],
    options?: Glob | GlobOptions
  ): Promise<string[]> => new Glob(pattern, options).process(),
  {
    sync: globSync,
    Glob,
    hasMagic,
  }
)

export { Glob } from './glob.js'
export type { GlobOptions } from './glob.js'
export { hasMagic } from './has-magic.js'
export default glob
