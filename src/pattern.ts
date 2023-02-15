// this is just a very light wrapper around 2 arrays with an offset index

import { GLOBSTAR } from 'minimatch'
type MMRegExp = RegExp & {
  _glob?: string
  _src?: string
}
export type MMPattern = string | MMRegExp | typeof GLOBSTAR

import LRUCache from 'lru-cache'
const cache = new LRUCache<string, Pattern>({ max: 256 })

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

const cacheKey = (index: number, patternList: PatternList): string =>
  index +
  '\n' +
  patternList
    .map(p =>
      typeof p === 'string' ? p : p instanceof RegExp ? String(p) : '**'
    )
    .join('\n')

export class Pattern {
  readonly patternList: PatternList
  readonly globList: GlobList
  readonly #index: number
  readonly length: number
  #rest?: Pattern | null
  #globString?: string
  #isDrive?: boolean
  #isUNC?: boolean
  #isAbsolute?: boolean

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
      throw new TypeError('index out of range')
    }
    this.patternList = patternList
    this.globList = globList
    this.#index = index

    // if the current item is not globstar, and the next item is .., skip ahead
    if (
      this.patternList[this.#index] !== GLOBSTAR &&
      this.patternList[this.#index] !== '..' &&
      this.patternList[this.#index + 1] === '..' &&
      this.length > this.#index + 2
    ) {
      this.#index += 2
    }

    // this is not so much to save on performance but more to ensure
    // that if we get the same pattern, we'll have the same Pattern object,
    // since these objects are used in cache entries to prevent rewalking.
    // It won't cause any incorrect behavior on a cache miss, but it may
    // adversely affect performance in really weird cases, like lots of
    // **/.. patterns and such.
    const key = cacheKey(index, patternList)
    const cached = cache.get(key)
    if (cached) return cached
    cache.set(key, this)

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
        const [p1, p2, p3, ...prest] = this.patternList
        const [g1, g2, g3, ...grest] = this.globList
        if (prest[0] === '') {
          // ends in /
          prest.shift()
          grest.shift()
        }
        const p = [p1, p2, p3, ''].join('/')
        const g = [g1, g2, g3, ''].join('/')
        this.patternList = [p, ...prest]
        this.globList = [g, ...grest]
        this.length = this.patternList.length
      } else if (this.isDrive() || this.isAbsolute()) {
        const [p1, ...prest] = this.patternList
        const [g1, ...grest] = this.globList
        if (prest[0] === '') {
          // ends in /
          prest.shift()
          grest.shift()
        }
        const p = (p1 as string) + '/'
        const g = g1 + '/'
        this.patternList = [p, ...prest]
        this.globList = [g, ...grest]
        this.length = this.patternList.length
      }
    } else {
      // discard any empty path portions, except the last one.
      while (this.#index < this.length - 1 && this.pattern() === '') {
        this.#index++
      }
    }
  }

  pattern(): MMPattern {
    return this.patternList[this.#index]
  }

  isString(): boolean {
    return typeof this.patternList[this.#index] === 'string'
  }
  isGlobstar(): boolean {
    return this.patternList[this.#index] === GLOBSTAR
  }
  isGlobstarDotDot(): boolean {
    return this.isGlobstar() && this.globList[this.#index + 1] === '..'
  }
  isMagic(): boolean {
    return this.patternList[this.#index] instanceof RegExp
  }

  // This has to be ALL THE WAY THROUGH, and done early
  expandGlobstarDotDot(): Pattern[] {
    const sets: Map<string, [PatternList, GlobList]> = new Map([
      [this.globList.join('/'), [this.patternList, this.globList]],
    ])

    let didSomething = false
    let keepGoing = false
    do {
      keepGoing = false
      for (const [globString, [patternList, globList]] of sets.entries()) {
        // only expand up from the current index, for safety.
        let gs: number = this.#index
        while (-1 !== (gs = patternList.indexOf(GLOBSTAR, gs + 1))) {
          const next = patternList[gs + 1]
          if (next !== '..') {
            continue
          }

          // ok, found one
          // expand it, and replace plgl
          sets.delete(globString)
          didSomething = true
          keepGoing = true

          const headGL = gs === 0 ? [] : globList.slice(0, gs)
          const headPL = gs === 0 ? [] : patternList.slice(0, gs)
          const restGL = globList.slice(gs + 2)
          const restPL = patternList.slice(gs + 2)
          const dotRestGL = restGL.length ? restGL : ['.']
          const dotRestPL = restPL.length ? restPL : ['.']

          sets.set([...headGL, '**', ...dotRestGL].join('/'), [
            [...headPL, GLOBSTAR, ...dotRestPL] as PatternList,
            [...headGL, '**', ...dotRestGL] as GlobList,
          ])
          sets.set([...headGL, '..', ...restGL].join('/'), [
            [...headPL, '..', ...restPL] as PatternList,
            [...headGL, '..', ...restGL] as GlobList,
          ])
          break
        }
      }

      for (const [globString, [patternList, globList]] of sets.entries()) {
        let pl: PatternList = patternList
        let gl: GlobList = globList
        let dd: number = this.#index - 1
        while (-1 !== (dd = patternList.indexOf('..', dd + 1))) {
          if (dd <= this.#index) {
            break
          }
          const prev = patternList[dd - 1]
          if (prev && prev !== GLOBSTAR && prev !== '.') {
            didSomething = true
            keepGoing = true
            sets.delete(globString)
            pl = [
              ...patternList.slice(0, dd - 1),
              ...patternList.slice(dd + 1),
            ] as PatternList
            gl = [
              ...globList.slice(0, dd - 1),
              ...globList.slice(dd + 1),
            ] as GlobList
            sets.set(gl.join('/'), [pl, gl])
            break
          }
        }
      }
      // **/*/<rest> -> */**/<rest>
      for (const [globString, [patternList, globList]] of sets.entries()) {
        let didSomething = false
        for (let i = 0; i < globList.length - 2; i++) {
          if (patternList[i] === GLOBSTAR) {
            let j = i
            while (j < patternList.length - 1 && globList[j + 1] === '*') {
              j++
            }
            if (i !== j) {
              didSomething = true
              patternList[i] = patternList[j]
              patternList[j] = GLOBSTAR
              globList[i] = '*'
              globList[j] = '**'
            }
          }
        }
        if (didSomething) {
          keepGoing = true
          sets.delete(globString)
          sets.set(globList.join('/'), [patternList, globList])
        }
      }
      // **/** => **
      for (const [globString, [patternList, globList]] of sets.entries()) {
        let didSomething = false
        for (let i = 0; i < globList.length - 2; i++) {
          if (patternList[i] === GLOBSTAR) {
            let j = i
            while (
              j < patternList.length - 1 &&
              patternList[j + 1] === GLOBSTAR
            ) {
              j++
            }
            if (i !== j) {
              didSomething = true
              patternList.splice(i, j - i)
              globList.splice(i, j - i)
            }
          }
        }
        if (didSomething) {
          keepGoing = true
          sets.delete(globString)
          sets.set(globList.join('/'), [patternList, globList])
        }
      }
    } while (keepGoing)

    if (!didSomething) return [this]

    // now sets is the fully expanded versions of each
    return [...sets.values()]
      .map(plgl => {
        if (!plgl) return undefined
        const [patternList, globList] = plgl
        const p = new Pattern(patternList, globList, this.#index)
        p.#isAbsolute = this.#isAbsolute
        p.#isUNC = this.#isUNC
        p.#isDrive = this.#isDrive
        return p
      })
      .filter(p => p) as Pattern[]
  }

  glob(): string {
    return this.globList[this.#index]
  }

  globString(): string {
    return (this.#globString =
      this.#globString ||
      (this.#index === 0
        ? this.isAbsolute()
          ? this.globList[0] + this.globList.slice(1).join('/')
          : this.globList.join('/')
        : this.globList.slice(this.#index).join('/')))
  }

  hasMore(): boolean {
    return this.length > this.#index + 1
  }

  rest(): Pattern | null {
    if (this.#rest !== undefined) return this.#rest
    if (!this.hasMore()) return (this.#rest = null)
    this.#rest = new Pattern(
      this.patternList,
      this.globList,
      this.#index + 1
    )
    this.#rest.#isAbsolute = this.#isAbsolute
    this.#rest.#isUNC = this.#isUNC
    this.#rest.#isDrive = this.#isDrive
    return this.#rest
  }

  // pattern like: //host/share/...
  // split = [ '', '', 'host', 'share', ... ]
  isUNC(pl = this.patternList): pl is UNCPatternList {
    return this.#isUNC !== undefined
      ? this.#isUNC
      : (this.#isUNC =
          isWin &&
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
  isDrive(pl = this.patternList): pl is DrivePatternList {
    return this.#isDrive !== undefined
      ? this.#isDrive
      : (this.#isDrive =
          isWin &&
          this.#index === 0 &&
          this.length > 1 &&
          typeof pl[0] === 'string' &&
          /^[a-z]:$/i.test(pl[0]))
  }

  // pattern = '/' or '/...' or '/x/...'
  // split = ['', ''] or ['', ...] or ['', 'x', ...]
  // Drive and UNC both considered absolute on windows
  isAbsolute(pl = this.patternList): pl is AbsolutePatternList {
    return this.#isAbsolute !== undefined
      ? this.#isAbsolute
      : (this.#isAbsolute =
          (pl[0] === '' && pl.length > 1) ||
          this.isDrive(pl) ||
          this.isUNC(pl))
  }

  // consume the root of the pattern, and return it
  root(): string {
    const p = this.patternList[0]
    return typeof p === 'string' && this.isAbsolute() && this.#index === 0
      ? p
      : ''
  }
}
