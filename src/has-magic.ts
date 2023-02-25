import { Glob, GlobOptions } from './glob.js'

export const hasMagic = (
  pattern: string | string[],
  options: GlobOptions = {}
): boolean => {
  if (!Array.isArray(pattern)) {
    pattern = [pattern]
  }
  const g = new Glob(pattern, options)
  return g.patterns.length === 0
    ? false
    : g.patterns.some(p => p.hasMagic())
}
