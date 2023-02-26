// this is just a very light wrapper around 2 arrays with an offset index

import { GLOBSTAR } from 'minimatch'
type MMRegExp = RegExp & {
  _glob?: string
  _src?: string
}
export type MMPattern = string | MMRegExp | typeof GLOBSTAR

// an array of length >= 1
type PatternList = [p: MMPattern, ...rest: MMPattern[]]
type UNCPatternList = [
  p0: '',
  p1: '',
  p2: string,
  p3: string,
  ...rest: MMPattern[]
]
type DrivePatternList = [p0: string, ...rest: MMPattern[]]
type AbsolutePatternList = [p0: '', ...rest: MMPattern[]]
type GlobList = [p: string, ...rest: string[]]

const isPatternList = (pl: MMPattern[]): pl is PatternList =>
  pl.length >= 1
const isGlobList = (gl: string[]): gl is GlobList => gl.length >= 1

export class Pattern {
  readonly #patternList: PatternList
  readonly #globList: GlobList
  readonly #index: number
  readonly length: number
  readonly #platform: NodeJS.Platform
  #rest?: Pattern | null
  #globString?: string
  #isDrive?: boolean
  #isUNC?: boolean
  #isAbsolute?: boolean
  #followGlobstar: boolean = true

  constructor(
    patternList: MMPattern[],
    globList: string[],
    index: number,
    platform: NodeJS.Platform
  ) {
    if (!isPatternList(patternList)) {
      throw new TypeError('empty pattern list')
    }
    if (!isGlobList(globList)) {
      throw new TypeError('empty glob list')
    }
    if (globList.length !== patternList.length) {
      throw new TypeError('mismatched pattern list and glob list lengths')
    }
    this.length = patternList.length
    if (index < 0 || index >= this.length) {
      throw new TypeError('index out of range')
    }
    this.#patternList = patternList
    this.#globList = globList
    this.#index = index
    this.#platform = platform

    // normalize root entries of absolute patterns on initial creation.
    if (this.#index === 0) {
      // c: => ['c:/']
      // C:/ => ['C:/']
      // C:/x => ['C:/', 'x']
      // //host/share => ['//host/share/']
      // //host/share/ => ['//host/share/']
      // //host/share/x => ['//host/share/', 'x']
      // /etc => ['/', 'etc']
      // / => ['/']
      if (this.isUNC()) {
        // '' / '' / 'host' / 'share'
        const [p0, p1, p2, p3, ...prest] = this.#patternList
        const [g0, g1, g2, g3, ...grest] = this.#globList
        if (prest[0] === '') {
          // ends in /
          prest.shift()
          grest.shift()
        }
        const p = [p0, p1, p2, p3, ''].join('/')
        const g = [g0, g1, g2, g3, ''].join('/')
        this.#patternList = [p, ...prest]
        this.#globList = [g, ...grest]
        this.length = this.#patternList.length
      } else if (this.isDrive() || this.isAbsolute()) {
        const [p1, ...prest] = this.#patternList
        const [g1, ...grest] = this.#globList
        if (prest[0] === '') {
          // ends in /
          prest.shift()
          grest.shift()
        }
        const p = (p1 as string) + '/'
        const g = g1 + '/'
        this.#patternList = [p, ...prest]
        this.#globList = [g, ...grest]
        this.length = this.#patternList.length
      }
    }
  }

  pattern(): MMPattern {
    return this.#patternList[this.#index]
  }

  isString(): boolean {
    return typeof this.#patternList[this.#index] === 'string'
  }
  isGlobstar(): boolean {
    return this.#patternList[this.#index] === GLOBSTAR
  }
  isRegExp(): boolean {
    return this.#patternList[this.#index] instanceof RegExp
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

  hasMore(): boolean {
    return this.length > this.#index + 1
  }

  rest(): Pattern | null {
    if (this.#rest !== undefined) return this.#rest
    if (!this.hasMore()) return (this.#rest = null)
    this.#rest = new Pattern(
      this.#patternList,
      this.#globList,
      this.#index + 1,
      this.#platform
    )
    this.#rest.#isAbsolute = this.#isAbsolute
    this.#rest.#isUNC = this.#isUNC
    this.#rest.#isDrive = this.#isDrive
    return this.#rest
  }

  // pattern like: //host/share/...
  // split = [ '', '', 'host', 'share', ... ]
  isUNC(pl = this.#patternList): pl is UNCPatternList {
    return this.#isUNC !== undefined
      ? this.#isUNC
      : (this.#isUNC =
          this.#platform === 'win32' &&
          this.#index === 0 &&
          pl[0] === '' &&
          pl[1] === '' &&
          typeof pl[2] === 'string' &&
          !!pl[2] &&
          typeof pl[3] === 'string' &&
          !!pl[3])
  }

  // pattern like C:/...
  // split = ['C:', ...]
  // XXX: would be nice to handle patterns like `c:*` to test the cwd
  // in c: for *, but I don't know of a way to even figure out what that
  // cwd is without actually chdir'ing into it?
  isDrive(pl = this.#patternList): pl is DrivePatternList {
    return this.#isDrive !== undefined
      ? this.#isDrive
      : (this.#isDrive =
          this.#platform === 'win32' &&
          this.#index === 0 &&
          this.length > 1 &&
          typeof pl[0] === 'string' &&
          /^[a-z]:$/i.test(pl[0]))
  }

  // pattern = '/' or '/...' or '/x/...'
  // split = ['', ''] or ['', ...] or ['', 'x', ...]
  // Drive and UNC both considered absolute on windows
  isAbsolute(pl = this.#patternList): pl is AbsolutePatternList {
    return this.#isAbsolute !== undefined
      ? this.#isAbsolute
      : (this.#isAbsolute =
          (pl[0] === '' && pl.length > 1) ||
          this.isDrive(pl) ||
          this.isUNC(pl))
  }

  // consume the root of the pattern, and return it
  root(): string {
    const p = this.#patternList[0]
    return typeof p === 'string' && this.isAbsolute() && this.#index === 0
      ? p
      : ''
  }

  hasMagic(): boolean {
    for (let i = 0; i < this.length; i++) {
      if (typeof this.#patternList[i] !== 'string') {
        return true
      }
    }
    return false
  }

  checkFollowGlobstar(): boolean {
    return !(
      this.#index === 0 ||
      !this.isGlobstar() ||
      !this.#followGlobstar
    )
  }

  markFollowGlobstar(): boolean {
    if (this.#index === 0 || !this.isGlobstar() || !this.#followGlobstar)
      return false
    this.#followGlobstar = false
    return true
  }
}
