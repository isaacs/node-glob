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

// TODO: this should be a parameter
const isWin = process.platform === 'win32'
const isPatternList = (pl: MMPattern[]): pl is PatternList =>
  pl.length >= 1
const isGlobList = (gl: string[]): gl is GlobList => gl.length >= 1

export class Pattern {
  patternList: PatternList
  globList: GlobList
  index: number
  length: number

  constructor(
    patternList: MMPattern[],
    globList: string[],
    index: number
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
    if (index >= this.length) {
      //console.error('P', [index, globList])
      throw new TypeError('index out of range')
    }
    this.patternList = patternList
    this.globList = globList
    this.index = index

    // do some cleanup of the pattern if we're starting out.
    if (this.index === 0) {
      // '//host/share' => '//host/share/'
      // 'c:' => 'c:/'
      if (
        (this.isUNC() && this.length === 4) ||
        (this.isDrive() && this.length === 1)
      ) {
        this.patternList.push('')
        this.globList.push('')
        this.length++
      }
    } else {
      // match bash behavior, discard any empty path portions that
      // follow a path portion with magic chars, except the last one.
      const prev = this.patternList[this.index - 1]
      while (
        typeof prev !== 'string' &&
        this.index < this.length - 1 &&
        this.pattern() === ''
      ) {
        this.shift()
      }
    }
  }

  pattern(): MMPattern {
    return this.patternList[this.index]
  }

  isString(): boolean {
    return typeof this.patternList[this.index] === 'string'
  }
  isGlobstar(): boolean {
    return this.patternList[this.index] === GLOBSTAR
  }
  isMagic(): boolean {
    return this.patternList[this.index] instanceof RegExp
  }
  shift() {
    if (this.index === this.length - 1) {
      throw new Error('cannot shift final pattern')
    }
    const p = this.pattern()
    this.index++
    return p
  }

  glob(): string {
    return this.globList[this.index]
  }

  globString(): string {
    return (
      this.index === 0 ? this.globList : this.globList.slice(this.index)
    ).join('/')
  }

  hasMore(): boolean {
    return this.length > this.index + 1
  }

  copy(): Pattern {
    return new Pattern(this.patternList, this.globList, this.index)
  }
  insert(p: MMPattern, g: string): Pattern {
    return new Pattern(
      [
        ...this.patternList.slice(0, this.index),
        p,
        ...this.patternList.slice(this.index),
      ],
      [
        ...this.globList.slice(0, this.index),
        g,
        ...this.globList.slice(this.index),
      ],
      this.index
    )
  }

  rest(): Pattern | null {
    return this.hasMore()
      ? new Pattern(this.patternList, this.globList, this.index + 1)
      : null
  }

  // pattern like: //host/share/...
  // split = [ '', '', 'host', 'share', ... ]
  isUNC(pl = this.patternList): pl is UNCPatternList {
    return (
      isWin &&
      this.index === 0 &&
      pl[0] === '' &&
      pl[1] === '' &&
      typeof pl[2] === 'string' &&
      !!pl[2] &&
      typeof pl[3] === 'string' &&
      !!pl[3]
    )
  }

  // pattern like C:/...
  // split = ['C:', ...]
  // XXX: would be nice to handle patterns like `c:*` to test the cwd
  // in c: for *, but I don't know of a way to even figure out what that
  // cwd is without actually chdir'ing into it?
  isDrive(pl = this.patternList): pl is DrivePatternList {
    return (
      isWin &&
      this.index === 0 &&
      this.length > 1 &&
      typeof pl[0] === 'string' &&
      /^[a-z]:$/i.test(pl[0])
    )
  }

  // pattern = '/' or '/...' or '/x/...'
  // split = ['', ''] or ['', ...] or ['', 'x', ...]
  // Drive and UNC both considered absolute on windows
  isAbsolute(pl = this.patternList): pl is AbsolutePatternList {
    return (
      (pl[0] === '' && this.length > 1) ||
      this.isDrive(pl) ||
      this.isUNC(pl)
    )
  }

  // consume the root of the pattern, and return it
  root(): string {
    if (this.index !== 0) {
      throw new Error('should only check root on initial walk')
    }
    // //x/y/z -> ['', '', x, y, z]
    // c:/x -> ['c:', x]
    // /x -> ['', 'x']
    const pl = this.patternList
    if (this.isUNC(pl)) {
      this.index = 4
      return pl[0] + pl[1] + pl[2] + pl[3]
    } else if (this.isDrive(pl) || this.isAbsolute(pl)) {
      this.index = 1
      return pl[0] + '/'
    } else {
      return ''
    }
  }
}
