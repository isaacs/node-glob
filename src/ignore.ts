// give it a pattern, and it'll be able to tell you if
// a given path should be ignored.
// Ignoring a path ignores its children if the pattern ends in /**
// Ignores are always parsed in dot:true mode

import { Minimatch } from 'minimatch'

export class Ignore {
  matchers: Minimatch[]
  gmatchers: Minimatch[]

  constructor(patterns: string[]) {
    this.matchers = []
    this.gmatchers = []
    for (const pattern of patterns) {
      this.matchers.push(new Minimatch(pattern, { dot: true }))
      if (pattern.substring(pattern.length - 3) === '/**') {
        const gp = pattern.replace(/(\/\*\*)+$/, '')
        this.gmatchers.push(new Minimatch(gp, { dot: true }))
      }
    }
  }

  ignored(p: string): boolean {
    return (
      this.matchers.some(m => m.match(p)) ||
      this.gmatchers.some(m => m.match(p))
    )
  }

  childrenIgnored(p: string): boolean {
    return this.gmatchers.some(m => m.match(p))
  }
}
