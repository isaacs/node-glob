// there's some special behavior if the pattern starts with '/'
// or if it starts with a drive letter on Windows systems.
// This is a weirdly specific test of unexported implementation, not my
// favorite, but it is the easiest way to verify what we expect here.
import t from 'tap'
import { posix, win32 } from 'path'

const setPlatform = (platform: string) => {
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
  const root = '/'
  const { GlobWalker } = t.mock('../dist/cjs/walker.js', {
    path: posix,
  })

  // pattern like [a]/[b]
  t.match(
    new GlobWalker([/^[a]$/, /^[b]$/], ''),
    {
      pattern: [/^[a]$/, /^[b]$/],
      path: '',
      cwd: '',
      start: '.',
    },
    'pattern=[a]/[b] path=""'
  )

  t.match(
    new GlobWalker(['', ''], '/tmp'),
    {
      pattern: [''],
      path: root,
      cwd: '',
      start: root,
    },
    'pattern=/'
  )

  t.match(
    new GlobWalker(['', 'x'], '/tmp'),
    {
      pattern: ['x'],
      path: root,
      cwd: '',
      start: root,
    },
    'pattern=/x'
  )

  t.match(
    new GlobWalker(['', 'x'], '/tmp', { cwd: '/a/b/c/d' }),
    {
      pattern: ['x'],
      path: root,
      cwd: '',
      start: root,
    },
    'pattern=/x'
  )

  t.match(new GlobWalker(['p:'], 'q:/tmp'), {
    pattern: ['p:'],
    path: 'q:/tmp',
    cwd: '',
    start: 'q:/tmp',
  })

  t.match(new GlobWalker(['p:', 'x'], 'q:/tmp'), {
    pattern: ['x'],
    path: 'q:/tmp/p:',
    cwd: '',
    start: 'q:/tmp/p:',
  })

  t.end()
})

t.test('win32', t => {
  setPlatform('win32')
  const { GlobWalker } = t.mock('../dist/cjs/walker.js', {
    path: win32,
  })
  const root = win32.resolve('/')

  t.match(
    new GlobWalker(['', ''], '/tmp'),
    {
      pattern: [''],
      path: root,
      cwd: root,
      start: root,
    },
    'pattern=/'
  )

  t.match(
    new GlobWalker(['', 'x'], '/tmp'),
    {
      pattern: ['x'],
      path: root,
      cwd: root,
      start: root,
    },
    'pattern=/x'
  )

  t.match(
    new GlobWalker(['', 'x'], '/tmp'),
    {
      pattern: ['x'],
      path: root,
      cwd: root,
      start: root,
    },
    'pattern=/x'
  )

  t.match(
    new GlobWalker(['', ''], 'q:/tmp'),
    {
      pattern: [''],
      path: 'q:/',
      cwd: 'q:/',
      start: 'q:/',
    },
    'pattern=/, path=q:/tmp'
  )

  t.match(
    new GlobWalker(['', 'x'], 'x:/tmp'),
    {
      pattern: ['x'],
      path: 'x:',
      cwd: 'x:',
      start: 'x:',
    },
    'pattern=/x, path=x:/tmp'
  )

  t.match(
    new GlobWalker(['', 'x'], 'y:/tmp'),
    {
      pattern: ['x'],
      path: 'y:',
      cwd: 'y:',
      start: 'y:',
    },
    'pattern=/x path=y:/tmp'
  )

  t.match(
    new GlobWalker(['p:'], 'q:/tmp'),
    {
      pattern: [''],
      path: 'p:',
      cwd: 'p:',
      start: 'p:',
    },
    'pattern=c: path=q:/tmp'
  )

  t.match(
    new GlobWalker(['p:', 'x'], 'q:/tmp'),
    {
      pattern: ['x'],
      path: 'p:',
      cwd: 'p:',
      start: 'p:',
    },
    'pattern=c:/x path=q:/tmp'
  )

  t.match(
    new GlobWalker(['', '', '?', 'p:'], 'q:/tmp'),
    {
      pattern: [''],
      path: '/?/p:',
      cwd: '/',
      start: '//?/p:',
    },
    'pattern=//?/p: path=q:/tmp'
  )

  t.match(
    new GlobWalker(['', '', '?', 'p:', /^[ab]$/], 'q:/tmp'),
    {
      pattern: [/^[ab]$/],
      path: '/?/p:',
      cwd: '/',
      start: '//?/p:',
    },
    'pattern=//?/p:/[ab] path=q:/tmp'
  )

  t.end()
})
