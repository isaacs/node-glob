import { GLOBSTAR, MatcherOpts, MMPattern } from './matcher.js'

const charUnescape = (s: string) => s.replace(/\\([^-\]])/g, '$1')
const braceEscape = (s: string) => s.replace(/[[\]\\]/g, '\\$&')
const globSpecialChars = new Set(['?', '*', '+', '@', '!', '[', '('])
const escapeInClass = new Set(['-', ']'])
const regExpEscape = (s: string) =>
  s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

export const compile = (
  pattern: string,
  options: MatcherOpts
): MMPattern => {
  if (pattern === '**') return GLOBSTAR
  if (pattern === '') return ''

  let m: RegExpMatchArray | null
  let fastTest: null | ((f: string) => boolean) = null
  if ((m = pattern.match(starRE))) {
    fastTest = options.dot ? starTestDot : starTest
  } else if ((m = pattern.match(starDotExtRE))) {
    fastTest = (
      options.nocase
        ? options.dot
          ? starDotExtTestNocaseDot
          : starDotExtTestNocase
        : options.dot
        ? starDotExtTestDot
        : starDotExtTest
    )(m[1])
  } else if ((m = pattern.match(qmarksRE))) {
    fastTest = (
      options.nocase
        ? options.dot
          ? qmarksTestNocaseDot
          : qmarksTestNocase
        : options.dot
        ? qmarksTestDot
        : qmarksTest
    )(m)
  } else if ((m = pattern.match(starDotStarRE))) {
    fastTest = options.dot ? starDotStarTestDot : starDotStarTest
  } else if ((m = pattern.match(dotStarRE))) {
    fastTest = dotStarTest
  }

  if (fastTest) {
    return Object.assign(/$./, {
      _glob: pattern,
      test: fastTest,
    })
  } else {
    // ok we have to actually compile it
    const re = compilePattern(pattern, options)
    return typeof re === 'string'
      ? re
      : Object.assign(re, {
          _glob: pattern,
        })
  }
}

const compilePattern = (
  pattern: string,
  options: MatcherOpts
): MMPattern => {
  const ast = tokenize(pattern, options)
  if (ast.length === 1 && ast[0][TokenField.TYPE] === TokenType.STRING) {
    return ast[0][TokenField.VALUE]
  }
  const re = assemble(ast, options, true)
  try {
    return new RegExp(re, options.nocase ? 'i' : '')
  } catch (er) {
    return /$./
  }
}

// Optimized checking for the most common glob patterns.
const starDotExtRE = /^\*+([^+@!?\*\[\(]*)$/
const starDotExtTest = (ext: string) => (f: string) =>
  !f.startsWith('.') && f.endsWith(ext)
const starDotExtTestDot = (ext: string) => (f: string) => f.endsWith(ext)
const starDotExtTestNocase = (ext: string) => {
  ext = ext.toLowerCase()
  return (f: string) => !f.startsWith('.') && f.toLowerCase().endsWith(ext)
}
const starDotExtTestNocaseDot = (ext: string) => {
  ext = ext.toLowerCase()
  return (f: string) => f.toLowerCase().endsWith(ext)
}
const starDotStarRE = /^\*+\.\*+$/
const starDotStarTest = (f: string) =>
  !f.startsWith('.') && f.includes('.')
const starDotStarTestDot = (f: string) =>
  f !== '.' && f !== '..' && f.includes('.')
const dotStarRE = /^\.\*+$/
const dotStarTest = (f: string) =>
  f !== '.' && f !== '..' && f.startsWith('.')
const starRE = /^\*+$/
const starTest = (f: string) => f.length !== 0 && !f.startsWith('.')
const starTestDot = (f: string) =>
  f.length !== 0 && f !== '.' && f !== '..'
const qmarksRE = /^\?+([^+@!?\*\[\(]*)?$/
const qmarksTestNocase = ([$0, ext = '']: RegExpMatchArray) => {
  const noext = qmarksTestNoExt([$0])
  if (!ext) return noext
  ext = ext.toLowerCase()
  return (f: string) => noext(f) && f.toLowerCase().endsWith(ext)
}
const qmarksTestNocaseDot = ([$0, ext = '']: RegExpMatchArray) => {
  const noext = qmarksTestNoExtDot([$0])
  if (!ext) return noext
  ext = ext.toLowerCase()
  return (f: string) => noext(f) && f.toLowerCase().endsWith(ext)
}
const qmarksTestDot = ([$0, ext = '']: RegExpMatchArray) => {
  const noext = qmarksTestNoExtDot([$0])
  return !ext ? noext : (f: string) => noext(f) && f.endsWith(ext)
}
const qmarksTest = ([$0, ext = '']: RegExpMatchArray) => {
  const noext = qmarksTestNoExt([$0])
  return !ext ? noext : (f: string) => noext(f) && f.endsWith(ext)
}
const qmarksTestNoExt = ([$0]: RegExpMatchArray) => {
  const len = $0.length
  return (f: string) => f.length === len && !f.startsWith('.')
}
const qmarksTestNoExtDot = ([$0]: RegExpMatchArray) => {
  const len = $0.length
  return (f: string) => f.length === len && f !== '.' && f !== '..'
}

// TOKENIZING

type AST = Token[]
type ExtToken = [t: TokenType.EXT, value: ExtGlobType, children: AST[]]
const isExtToken = (t: Token): t is ExtToken =>
  t[TokenField.TYPE] === TokenType.EXT
type StringToken = [t: TokenType.STRING, value: string]
const isStringToken = (t: Token): t is StringToken =>
  t[TokenField.TYPE] === TokenType.STRING
type StarToken = [t: TokenType.STAR, value: '*']
const isStarToken = (t: Token): t is StarToken =>
  t[TokenField.TYPE] === TokenType.STAR
type QmarkToken = [t: TokenType.QMARK, value: '?']
const isQmarkToken = (t: Token): t is QmarkToken =>
  t[TokenField.TYPE] === TokenType.QMARK
type ClassToken = [t: TokenType.CLASS, value: string]
const isClassToken = (t: Token): t is ClassToken =>
  t[TokenField.TYPE] === TokenType.CLASS
type Token = ExtToken | StringToken | StarToken | QmarkToken | ClassToken

enum TokenField {
  TYPE,
  VALUE,
  CHILDREN,
}
enum TokenType {
  STRING,
  STAR,
  EXT,
  QMARK,
  CLASS,
}

type ExtGlobType = '?' | '*' | '+' | '@' | '!'
const extGlobTypes: Set<ExtGlobType> = new Set(['?', '*', '+', '@', '!'])
const isExtGlobType = (s: string): s is ExtGlobType =>
  extGlobTypes.has(s as ExtGlobType)

const extTypes: { [k in ExtGlobType]: { open: string; close: string } } = {
  '!': { open: '(?:(?!(?:', close: ').*?))' },
  '?': { open: '(?:', close: ')?' },
  '+': { open: '(?:', close: ')+' },
  '*': { open: '(?:', close: ')*' },
  '@': { open: '(?:', close: ')' },
}

const tokenize = (
  pattern: string,
  options: MatcherOpts,
  ast: AST = []
): AST => {
  // tokenize the string up into chunks first
  // sort of like an AST of the pattern
  // each node is [type, value, [...children]]
  // root, or children of extglobs, are an array of nodes
  // so 'i\?jk?*.@(xy[a-c]|!(foo|ba*r))baz*bo' becomes:
  // [
  //  [STRING, 'i?jk'],
  //  [QMARK, '?'],
  //  [STAR, '*'],
  //  [STRING, '.'],
  //  [EXT, '@', [
  //    [[STRING, 'xy'], [CLASS, 'a-c']],
  //    [[EXT, '!', [
  //      [[STRING, 'foo']],
  //      [[STRING, 'ba'], [STAR, '*'], [STRING, 'r']]
  //    ]]],
  //  ]],
  //  [STRING, 'baz'],
  //  [STAR, '*'],
  //  [STRING, 'bo'],
  // ]
  //
  // which turns into the regexp:
  // ^i\?jk..*?\.(?:xy[a-c]|(?:(?!(?:foo|ba.*?r).*$)))baz.*?bo$
  // Place the "no dot allowed" if the AST starts at position 0,
  // and is a *, ?, or class at the start
  let i: number = 0
  const length = pattern.length
  while (i < length) {
    let c = pattern.charAt(i)
    // take our best guess as to what it is
    // the other tokenizers will append to the AST and return
    // the amount of string that was consumed.
    if (
      !options.noext &&
      isExtGlobType(c) &&
      pattern.charAt(i + 1) === '('
    ) {
      const consumed = tokenizeExt(pattern, options, i, ast)
      if (consumed) {
        i += consumed
        c = pattern.charAt(i)
        continue
      }
    }
    if (c === '[') {
      const consumed = tokenizeClass(pattern, options, i, ast)
      if (consumed) {
        i += consumed
        continue
      }
    }
    if (c === '*') {
      ast.push([TokenType.STAR, '*'])
    } else if (c === '?') {
      ast.push([TokenType.QMARK, '?'])
    } else {
      const consumed = tokenizeNonMagic(pattern, options, i, ast)
      if (consumed) {
        i += consumed
        c = pattern.charAt(i)
        continue
      }
    }
    i++
  }
  return ast
}

const tokenizeExt = (
  pattern: string,
  options: MatcherOpts,
  i: number,
  ast: AST
): number => {
  const extType = pattern.charAt(i)
  if (!isExtGlobType(extType)) {
    throw new Error('invalid extglob type: ' + extType)
  }
  const matchStack: string[] = []
  const pipes: number[] = []
  let p: number
  const length = pattern.length
  let end = -1
  let escaping = false

  // first split out the top-level set of strings
  // if we can't do that, it's not a valid extglob
  for (p = i + 2; p < length; p++) {
    const c = pattern.charAt(p)
    if (escaping) {
      escaping = false
      continue
    }
    if (c === '\\') {
      escaping = true
      continue
    }
    if (c === ']') {
      if (matchStack[0] === '[' && pattern.charAt(p - 1) !== '[') {
        matchStack.shift()
      }
    } else if (c === ')') {
      if (!matchStack.length) {
        // finished!
        end = p
        break
      } else if (matchStack[0] === '(') {
        matchStack.shift()
      }
    } else if (c === '(') {
      if (matchStack[0] !== '[' && isExtGlobType(pattern.charAt(p - 1))) {
        matchStack.unshift(c)
      }
    } else if (c === '|' && matchStack.length === 0) {
      pipes.push(p)
    }
  }

  if (!end || matchStack.length) {
    return 0
  }

  // i + 1, pipes, and end define the outside boundaries of the subs
  const subPatterns: string[] = []
  let start = i + 2
  for (const pipe of pipes) {
    subPatterns.push(pattern.substring(start, pipe))
    start = pipe + 1
  }
  subPatterns.push(pattern.substring(start, end))

  const subTokenized = subPatterns.map(p => tokenize(p, options))
  ast.push([TokenType.EXT, extType, subTokenized])
  return end - i + 1
}

const tokenizeClass = (
  pattern: string,
  _: MatcherOpts,
  i: number,
  ast: AST
): number => {
  // walk until we find the closing ] that is not escaped or the first char
  // return 0 if it's not a valid class (basically, just if it's left open)
  let p: number
  let escaping = false
  const length = pattern.length
  let s = ''
  for (p = i + 1; p < length; p++) {
    const c = pattern.charAt(p)
    if (c === '\\' && !escaping) {
      escaping = true
      continue
    }
    if (p === i + 1 && c === ']') {
      s += c
      continue
    }
    if (escaping) {
      escaping = false
      if (escapeInClass.has(c)) {
        s += '\\'
      }
      s += c
      continue
    }
    if (c === ']') {
      ast.push([TokenType.CLASS, s])
      return p - i + 1
    }
    s += c
  }
  return 0
}

const tokenizeNonMagic = (
  pattern: string,
  _: MatcherOpts,
  i: number,
  ast: AST
): number => {
  let escaping = false
  let p = i
  let sawFirst = false
  const length = pattern.length
  let s = ''
  for (p = i; p < length; p++) {
    let c = pattern.charAt(p)
    if (c === '\\' && !escaping) {
      escaping = true
      continue
    }

    if (escaping) {
      escaping = false
      s += c
      continue
    }

    // this is only called when we KNOW the first char is not magic,
    // so no need to stop for that at the outset.
    if (!sawFirst) {
      sawFirst = true
      s += c
      continue
    }

    if (globSpecialChars.has(c)) {
      break
    }

    s += c
  }

  ast.push([TokenType.STRING, s])
  return p - i
}

// COMPILATION

export const assemble = (
  ast: AST,
  options: MatcherOpts,
  isTop = false,
  isStart = true
): string => {
  const negativeExts: number[] = []
  const re: string[] = []
  let stillStart = isStart
  let maybeEmpty = true
  for (let i = 0; i < ast.length; i++) {
    const token = ast[i]
    if (isStringToken(token)) {
      if (token[TokenField.VALUE] !== '') {
        maybeEmpty = false
      }
      re.push(assembleNonMagic(token, options))
    } else if (isClassToken(token)) {
      maybeEmpty = false
      re.push(assembleClass(token, options))
    } else if (isExtToken(token)) {
      if (token[TokenField.VALUE] === '!') {
        negativeExts.push(i)
      }
      re.push(assembleExt(token, options, stillStart))
    } else if (isQmarkToken(token)) {
      maybeEmpty = false
      re.push(assembleQmark(token, options))
    } else if (isStarToken(token)) {
      re.push(assembleStar(token, options))
      /* c8 ignore start */
    } else {
      throw new TypeError('unknown token type: ' + token)
    }
    /* c8 ignore stop */
    stillStart = false
  }

  if (isTop) {
    re.push('$')
  }

  // a negative extglob is:
  // ((?!(sub|patterns)<rest of the pattern>).*?)
  // so we need to do it in two passes.
  for (let i = negativeExts.length - 1; i >= 0; i--) {
    const n = negativeExts[i]
    re[n] += assembleNegativeExtClose(re, n)
  }
  if (isTop) {
    if (!options.dot && needDotProtection(ast)) {
      re.unshift('(?!^\\.)')
    }
    if (maybeEmpty) {
      re.unshift('(?=.)')
    }
    re.unshift('^')
  } else if (isStart) {
    if (!options.dot && needDotProtection(ast)) {
      re.unshift('(?!^\\.)')
    }
  }
  return re.join('')
}

const needDotProtection = (ast: AST) => {
  const first = ast[0]
  return isClassToken(first) || isStarToken(first) || isQmarkToken(first)
}

const assembleQmark = (_: QmarkToken, __: MatcherOpts) => '.'
const assembleStar = (_: StarToken, __: MatcherOpts) => '.*?'
const assembleNonMagic = (token: StringToken, _: MatcherOpts) =>
  regExpEscape(token[TokenField.VALUE])

const assembleClass = (token: ClassToken, _: MatcherOpts) => {
  // TODO: posix classes
  const cls = braceEscape(charUnescape(token[TokenField.VALUE]))
  const re = `[${cls}]`
  // handle out of order classes, like `[z-a]`, which throw
  // in javascript, but just match nothing in glob syntax.
  try {
    RegExp(re)
    return re
  } catch (_) {
    return '$.'
  }
}

const assembleExt = (
  token: ExtToken,
  options: MatcherOpts,
  isStart: boolean
): string => {
  const t = token[TokenField.VALUE]
  const open = extTypes[t].open
  const close = t === '!' ? '' : extTypes[t].close
  const subs = token[TokenField.CHILDREN]
  const body = subs
    .map(ast => assemble(ast, options, false, isStart))
    .join('|')
  return open + body + close
}

const assembleNegativeExtClose = (re: string[], n: number): string => {
  // walk the AST from i onwards, collecting the regexp
  // then add the end bit:
  // ((?!(sub|patterns)<rest of the pattern>).*?)
  //                  ^-- from here on
  let s: string = ')'
  for (let i = n + 1; i < re.length; i++) {
    s += re[i]
  }
  s += ').*?)'
  return s
}
