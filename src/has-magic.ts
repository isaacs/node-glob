import { Glob, GlobOptions } from './glob.js'

export const hasMagic = (
  pattern: string | string[],
  options?: Glob | GlobOptions
): boolean => {
  if (!Array.isArray(pattern)) {
    pattern = [pattern]
  }
  return pattern.some(p => {
    const g = new Glob(p, options)
    if (g.matchSet.length === 0) {
      return false
    }
    if (g.matchSet.length > 1) {
      return true
    }
    return g.matchSet[0].some(p => typeof p !== 'string')
  })
}
