// this is just a very light wrapper around 2 arrays with an offset index
// Pattern objects are effectively an immutable view over an array of
// glob strings, which can return the compiled part on demand as needed.

import { GLOBSTAR, MatcherOpts, MMPattern } from './matcher.js'
import { compile } from './compiler.js'
export type GlobList = [p: string, ...rest: string[]]
export const isGlobList = (gl: string[]): gl is GlobList => gl.length >= 1

export type Compiled = Map<string, MMPattern>

export class Pattern {
  #options: MatcherOpts
  #globList: GlobList
  readonly length: number
  #index: number
  #compiled: Compiled

  // memoizing
  #pattern?: MMPattern
  #rest?: Pattern | null
  #globString?: string

  constructor(
    globList: GlobList,
    index: number,
    compiled: Compiled,
    options: MatcherOpts
  ) {
    if (!isGlobList(globList)) {
      throw new TypeError('empty glob list')
    }
    this.#globList = globList
    if (index >= globList.length) {
      throw new TypeError('index out of range')
    }
    this.length = globList.length
    this.#options = options
    this.#index = index
    this.#compiled = compiled
  }

  glob(): string {
    return this.#globList[this.#index]
  }

  isGlobstar(): boolean {
    return this.pattern() === GLOBSTAR
  }
  isRegExp(): boolean {
    return this.pattern() instanceof RegExp
  }
  isString(): boolean {
    return typeof this.pattern() === 'string'
  }

  pattern(): MMPattern {
    if (this.#pattern !== undefined) {
      return this.#pattern
    }
    const glob = this.glob()
    if (glob.endsWith('/')) {
      return (this.#pattern = glob)
    }
    const cached = this.#compiled.get(glob)
    if (cached !== undefined) {
      return (this.#pattern = cached)
    }
    const pattern = compile(glob, this.#options)
    this.#compiled.set(glob, pattern)
    return (this.#pattern = pattern)
  }

  isAbsolute(): boolean {
    return this.#globList[0].endsWith('/')
  }

  root(): string {
    return this.#index === 0 && this.isAbsolute() ? this.#globList[0] : ''
  }

  globString(): string {
    return (this.#globString =
      this.#globString ||
      (this.#index === 0
        ? this.isAbsolute()
          ? this.#globList[0] + this.#globList.slice(1).join('/')
          : this.#globList.join('/')
        : this.#globList.slice(this.#index).join('/')))
  }

  rest(): Pattern | null {
    if (this.#rest !== undefined) return this.#rest
    if (this.#index >= this.length - 1) return (this.#rest = null)
    const rest = new Pattern(
      this.#globList,
      this.#index + 1,
      this.#compiled,
      this.#options
    )
    this.#rest = rest
    return rest
  }

  hasMore(): this is PatternWithMore {
    return this.#index < this.length - 1
  }
}

interface PatternWithMore extends Pattern {
  rest(): Pattern
}
