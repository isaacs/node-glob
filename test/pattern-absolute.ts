// there's some special behavior if the pattern starts with '/'
// or if it starts with a drive letter on Windows systems.
// This is a weirdly specific test of unexported implementation, not my
// favorite, but it is the easiest way to verify what we expect here.
import t from 'tap'
import {GlobWalker} from '../dist/cjs/walker.js'

const setPlatform = (platform:string) => {
Object.defineProperty(process, 'platform', {
  value: platform,
  enumerable: true,
  configurable: true,
  writable: true,
})
}

const { platform } = process
t.teardown(() => setPlatform(platform))

t.test('posix', t => {
  setPlatform('posix')

  // pattern like [a]/[b]
  t.match(new GlobWalker([/^[a]$/, /^[b]$/], ''), {
    pattern: [/^[a]$/, /^[b]$/],
    path: '',
    cwd: '',
    start: '.',
  }, 'pattern=[a]/[b] path=""')

  t.match(new GlobWalker(['', ''], '/tmp'), {
    pattern: [''],
    path: '/',
    cwd: '/',
    start: '/',
  }, 'pattern=/')

  t.match(new GlobWalker(['', 'x'], '/tmp'), {
    pattern: ['x'],
    path: '/',
    cwd: '/',
    start: '/',
  }, 'pattern=/x')

  t.match(new GlobWalker(['', 'x'], '/tmp'), {
    pattern: ['x'],
    path: '/',
    cwd: '/',
    start: '/',
  }, 'pattern=/x')

  t.match(new GlobWalker(['c:'], 'd:/tmp'), {
    pattern: ['c:'],
    path: 'd:/tmp',
    cwd: '',
    start: 'd:/tmp',
  })

  t.match(new GlobWalker(['c:', 'x'], 'd:/tmp'), {
    pattern: ['x'],
    path: 'd:/tmp/c:',
    cwd: '',
    start: 'd:/tmp/c:',
  })

  t.end()
})

t.test('win32', t => {
  setPlatform('win32')

  t.match(new GlobWalker(['', ''], '/tmp'), {
    pattern: [''],
    path: '/',
    cwd: '/',
    start: '/',
  }, 'pattern=/')

  t.match(new GlobWalker(['', 'x'], '/tmp'), {
    pattern: ['x'],
    path: '/',
    cwd: '/',
    start: '/',
  }, 'pattern=/x')

  t.match(new GlobWalker(['', 'x'], '/tmp'), {
    pattern: ['x'],
    path: '/',
    cwd: '/',
    start: '/',
  }, 'pattern=/x')

  t.match(new GlobWalker(['', ''], 'd:/tmp'), {
    pattern: [''],
    path: 'd:/',
    cwd: 'd:/',
    start: 'd:/',
  }, 'pattern=/, path=d:/tmp')

  t.match(new GlobWalker(['', 'x'], 'x:/tmp'), {
    pattern: ['x'],
    path: 'x:',
    cwd: 'x:',
    start: 'x:',
  }, 'pattern=/x, path=x:/tmp')

  t.match(new GlobWalker(['', 'x'], 'y:/tmp'), {
    pattern: ['x'],
    path: 'y:',
    cwd: 'y:',
    start: 'y:',
  }, 'pattern=/x path=y:/tmp')

  t.match(new GlobWalker(['c:'], 'd:/tmp'), {
    pattern: [''],
    path: 'c:',
    cwd: 'c:',
    start: 'c:',
  }, 'pattern=c: path=d:/tmp')

  t.match(new GlobWalker(['c:', 'x'], 'd:/tmp'), {
    pattern: ['x'],
    path: 'c:',
    cwd: 'c:',
    start: 'c:',
  }, 'pattern=c:/x path=d:/tmp')

  t.end()
})
