import * as fs from 'fs'
import t from 'tap'

const cwd = process.cwd()
const drive = /^[a-zA-Z]:[\\\/]/.test(cwd)
  ? cwd.charAt(0).toLowerCase()
  : 'c'

const fakeStat = (
  path: string
): { isDirectory: () => boolean; isSymbolicLink: () => boolean } => {
  let ret: { isDirectory: () => boolean; isSymbolicLink: () => false }
  switch (path.toLowerCase().replace(/\\/g, '/')) {
    case '/tmp':
    case '/tmp/':
    case drive + ':/tmp':
    case drive + ':/tmp/':
      ret = {
        isSymbolicLink: () => false,
        isDirectory: () => true,
      }
      break
    case '/tmp/a':
    case drive + ':/tmp/a':
      ret = {
        isSymbolicLink: () => false,
        isDirectory: () => false,
      }
      break
    default:
      throw new Error('invalid: ' + path)
  }
  return ret
}

const join = (r: string, p: string) =>
  r === '/' ? `${r}${p}` : `${r}/${p}`

function fakeReaddir(path: string) {
  let ret: string[]
  switch (path.toLowerCase().replace(/\\/g, '/')) {
    case '/tmp':
    case '/tmp/':
    case drive + ':/tmp':
    case drive + ':/tmp/':
      ret = ['a', 'A']
      break
    case '/':
    case drive + ':':
    case drive + ':/':
      ret = ['tMp', 'tmp', 'tMP', 'TMP']
      break
    default:
      throw new Error('not mocked')
  }
  return ret.map(name => ({ name, ...fakeStat(join(path, name)) }))
}

const mockFs = {
  ...fs,
  readdir: (
    path: string,
    _options: { withFileTypes: true },
    cb: (
      er: null | NodeJS.ErrnoException,
      entries?: ReturnType<typeof fakeReaddir>
    ) => void
  ) => {
    try {
      const f = fakeReaddir(path)
      process.nextTick(() => cb(null, f))
    } catch (_) {
      fs.readdir(path, { withFileTypes: true }, cb)
    }
  },

  readdirSync: (path: string, _options?: { withFileTypes: true }) => {
    try {
      return fakeReaddir(path)
    } catch (_) {
      return fs.readdirSync(path, { withFileTypes: true })
    }
  },
}

const { glob } = t.mock('../dist/cjs/index.js', { fs: mockFs })

t.test('nocase, nomagic', async t => {
  const raw = [
    '/TMP/A',
    '/TMP/a',
    '/tMP/A',
    '/tMP/a',
    '/tMp/A',
    '/tMp/a',
    '/tmp/A',
    '/tmp/a',
  ]
  const want =
    process.platform === 'win32' ? raw.map(p => drive + ':' + p) : raw

  await Promise.all(
    ['/tmp/a', '/TmP/A'].map(async pattern => {
      const rawRes: string[] = await glob(pattern, { nocase: true })
      const g = new glob.Glob(pattern, { nocase: true })
      const res =
        process.platform === 'win32'
          ? rawRes.map(r =>
              r
                .replace(/\\/g, '/')
                .replace(new RegExp('^' + drive + ':', 'i'), drive + ':')
            )
          : rawRes
      t.same(res.sort(), want, pattern)
    })
  )
})

t.test('nocase, with some magic', async t => {
  const raw = [
    '/TMP/A',
    '/TMP/a',
    '/tMP/A',
    '/tMP/a',
    '/tMp/A',
    '/tMp/a',
    '/tmp/A',
    '/tmp/a',
  ]
  const want =
    process.platform === 'win32' ? raw.map(p => drive + ':' + p) : raw

  await Promise.all(
    ['/tmp/*', '/tMp/*'].map(async pattern => {
      const resRaw: string[] = glob.sync(pattern, { nocase: true })
      const res =
        process.platform === 'win32'
          ? resRaw.map(r =>
              r
                .replace(/\\/g, '/')
                .replace(new RegExp('^' + drive + ':', 'i'), drive + ':')
            )
          : resRaw
      t.same(res.sort(), want)
    })
  )
})
