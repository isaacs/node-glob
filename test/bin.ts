import { spawn, type SpawnOptions } from 'child_process'
import { readFileSync } from 'fs'
import { sep } from 'path'
import t from 'tap'
import { fileURLToPath } from 'url'
const { version } = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../package.json', import.meta.url)),
    'utf8',
  ),
)
const bin = fileURLToPath(new URL('../dist/esm/bin.mjs', import.meta.url))

const foregroundChildCalls: [
  string,
  string[],
  undefined | SpawnOptions,
][] = []
let mockForegroundChildAwaiting: undefined | Promise<void> = undefined
let resolveMockForegroundChildAwaiting: undefined | (() => void) =
  undefined
const expectForegroundChild = () =>
  new Promise<void>(res => (resolveMockForegroundChildAwaiting = res))
const mockForegroundChild = {
  foregroundChild: async (
    cmd: string,
    args: string[],
    options?: SpawnOptions,
  ) => {
    resolveMockForegroundChildAwaiting?.()
    resolveMockForegroundChildAwaiting = undefined
    mockForegroundChildAwaiting = undefined
    foregroundChildCalls.push([cmd, args, options])
  },
}
t.beforeEach(() => (foregroundChildCalls.length = 0))

t.cleanSnapshot = s => s.split(version).join('{VERSION}')

interface Result {
  args: string[]
  options: SpawnOptions
  stdout: string
  stderr: string
  code: number | null
  signal: NodeJS.Signals | null
}
const run = async (args: string[], options = {}) => {
  const proc = spawn(
    process.execPath,
    ['--enable-source-maps', bin, ...args],
    options,
  )
  const out: Buffer[] = []
  const err: Buffer[] = []
  proc.stdout.on('data', c => out.push(c))
  proc.stderr.on('data', c => err.push(c))
  return new Promise<Result>(res => {
    proc.on('close', (code, signal) => {
      res({
        args,
        options,
        stdout: Buffer.concat(out).toString(),
        stderr: Buffer.concat(err).toString(),
        code,
        signal,
      })
    })
  })
}

t.test('usage', async t => {
  t.matchSnapshot(await run(['-h']), '-h shows usage')
  const res = await run([])
  t.equal(res.code, 1, 'exit with code 1 when no args')
  t.match(res.stderr, 'No patterns provided')
  t.match(res.stderr, /-h --help +Show this usage information$/m)
  const badp = await run(['--platform=glorb'])
  t.equal(badp.code, 1, 'exit with code 1 on bad platform arg')
  t.match(badp.stderr, 'Invalid value provided for --platform: "glorb"\n')
})

t.test('version', async t => {
  t.matchSnapshot(await run(['-V']), '-V shows version')
  t.matchSnapshot(await run(['--version']), '--version shows version')
})

// Note: this test works without --shell because we only run it on bash.
// exercises the "safely add cmd args to shell cmd" path.
t.test('finds matches for a pattern', async t => {
  const cwd = t.testdir({
    a: {
      'x.y': '',
      'x.a': '',
      b: {
        'z.y': '',
        'z.a': '',
      },
    },
  })
  const res = await run(['**/*.y'], { cwd })
  t.match(res.stdout, `a${sep}x.y\n`)
  t.match(res.stdout, `a${sep}b${sep}z.y\n`)

  const c = `node -p "process.argv.map(s=>s.toUpperCase())"`
  const cmd = await run(['**/*.y', '-c', c], { cwd })
  t.match(cmd.stdout, `'a${sep.replace(/\\/g, '\\\\')}x.y'`.toUpperCase())
  t.match(
    cmd.stdout,
    `'a${sep.replace(/\\/g, '\\\\')}b${sep.replace(
      /\\/g,
      '\\\\',
    )}z.y'`.toUpperCase(),
  )
})

t.test('append positional args safely to shell in fish', async t => {
  const cwd = t.testdir({
    a: {
      'x.y': '',
      'x.a': '',
      b: {
        'z.y': '',
        'z.a': '',
      },
    },
  })
  const { SHELL } = process.env
  t.teardown(() => (process.env.SHELL = SHELL))
  process.env.SHELL = '/usr/local/bin/fish'
  const p = expectForegroundChild()
  t.chdir(cwd)
  const c = `node -p "process.argv.map(s=>s.toUpperCase())"`
  t.intercept(process, 'argv', {
    value: [process.argv[0], 'glob', '**/*.y', '-c', c],
  })

  await t.mockImport('../dist/esm/bin.mjs', {
    'foreground-child': mockForegroundChild,
  })
  await p
  t.strictSame(foregroundChildCalls, [
    [
      '/usr/local/bin/fish',
      [
        '-c',
        'node -p "process.argv.map(s=>s.toUpperCase())" "$argv"',
        'a/x.y',
        'a/b/z.y',
      ],
      undefined,
    ],
  ])
})

t.test('UNSAFE positional args with --shell', async t => {
  const cwd = t.testdir({
    a: {
      'x.y': '',
      'x.a': '',
      b: {
        'z.y': '',
        'z.a': '',
      },
    },
  })
  const { SHELL } = process.env
  t.teardown(() => (process.env.SHELL = SHELL))
  process.env.SHELL = '/some/unknown/thing'

  const p = expectForegroundChild()
  t.chdir(cwd)
  const c = `node -p "process.argv.map(s=>s.toUpperCase())"`
  t.intercept(process, 'argv', {
    value: [process.argv[0], 'glob', '--shell', '**/*.y', '-c', c],
  })
  const warnings: [string, string, string][] = []
  t.intercept(process, 'emitWarning', {
    value: (a: string, b: string, c: string) => warnings.push([a, b, c]),
  })

  await t.mockImport('../dist/esm/bin.mjs', {
    'foreground-child': mockForegroundChild,
  })
  await p
  t.strictSame(foregroundChildCalls, [
    [c, ['a/x.y', 'a/b/z.y'], { shell: true }],
  ])
  t.strictSame(warnings, [
    [
      'The --shell option is unsafe, and will be removed. To pass positional arguments to the subprocess, use -g/--cmd-arg instead.',
      'DeprecationWarning',
      'GLOB_SHELL',
    ],
  ])
})

t.test('safe positional args with --cmd-arg/-g', async t => {
  const cwd = t.testdir({
    a: {
      'x.y': '',
      'x.a': '',
      b: {
        'z.y': '',
        'z.a': '',
      },
    },
  })
  const { SHELL } = process.env
  t.teardown(() => (process.env.SHELL = SHELL))
  process.env.SHELL = '/some/unknown/thing'

  const p = expectForegroundChild()
  t.chdir(cwd)
  const c = 'node'
  t.intercept(process, 'argv', {
    value: [
      process.argv[0],
      'glob',
      '**/*.y',
      '-c',
      c,
      '-g-p',
      '--cmd-arg',
      'process.argv.map(s=>s.toUpperCase())',
    ],
  })
  const warnings: [string, string, string][] = []
  t.intercept(process, 'emitWarning', {
    value: (a: string, b: string, c: string) => warnings.push([a, b, c]),
  })

  await t.mockImport('../dist/esm/bin.mjs', {
    'foreground-child': mockForegroundChild,
  })
  await p
  t.strictSame(foregroundChildCalls, [
    [
      c,
      ['-p', 'process.argv.map(s=>s.toUpperCase())', 'a/x.y', 'a/b/z.y'],
      { shell: false },
    ],
  ])
  t.strictSame(warnings, [])
})

t.test('prioritizes exact match if exists, unless --all', async t => {
  const cwd = t.testdir({
    routes: {
      '[id].tsx': '',
      'i.tsx': '',
      'd.tsx': '',
    },
  })
  const res = await run(['routes/[id].tsx'], { cwd })
  t.equal(res.stdout, `routes${sep}[id].tsx\n`)

  const all = await run(['routes/[id].tsx', '--all'], { cwd })
  t.match(all.stdout, `routes${sep}i.tsx\n`)
  t.match(all.stdout, `routes${sep}d.tsx\n`)
})

t.test('uses default pattern if none provided', async t => {
  const cwd = t.testdir({
    a: {
      'x.y': '',
      'x.a': '',
      b: {
        'z.y': '',
        'z.a': '',
      },
    },
  })

  const def = await run(['-p', '**/*.y'], { cwd })
  t.match(def.stdout, `a${sep}x.y\n`)
  t.match(def.stdout, `a${sep}b${sep}z.y\n`)

  const exp = await run(['-p', '**/*.y', '**/*.a'], { cwd })
  t.match(exp.stdout, `a${sep}x.a\n`)
  t.match(exp.stdout, `a${sep}b${sep}z.a\n`)
})
