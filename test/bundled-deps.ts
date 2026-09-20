import { readdirSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import t, { type Test } from 'tap'
import { fileURLToPath } from 'url'

const repoRoot = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
)

// Floors from the advisories cited by #657, plus later
// brace-expansion DoS fixes that still apply through 5.0.8.
// A lockfile/bundle that freezes pre-fix copies must fail this test.
const MIN_MINIMATCH = '10.2.3'
const MIN_BRACE_EXPANSION = '5.0.9'

type SourceMap = {
  sources: string[]
  sourcesContent?: (string | null)[]
}

type PkgJson = {
  name?: string
  version?: string
}

const posix = (p: string) => p.replace(/\\/g, '/')

const gte = (version: string, min: string) => {
  const a = version.split('.').map(Number)
  const b = min.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av > bv) return true
    if (av < bv) return false
  }
  return true
}

const packageFromSource = (mapFile: string, source: string) => {
  let dir = resolve(dirname(mapFile), source)
  for (;;) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(dir, 'package.json'), 'utf8'),
      ) as PkgJson
      if (pkg.name && pkg.version) {
        return { root: dir, name: pkg.name, version: pkg.version }
      }
    } catch {
      // keep walking toward the filesystem root
    }
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(`no package.json above ${source}`)
    }
    dir = parent
  }
}

const installedSourceContents = (pkgRoot: string) => {
  const contents = new Map<string, string>()
  const distEsm = join(pkgRoot, 'dist', 'esm')
  for (const file of readdirSync(distEsm)) {
    if (!file.endsWith('.js.map')) continue
    const map = JSON.parse(
      readFileSync(join(distEsm, file), 'utf8'),
    ) as SourceMap
    map.sources.forEach((source, i) => {
      const content = map.sourcesContent?.[i]
      if (!source || content == null) return
      const tail = posix(source).split('/').slice(-2).join('/')
      contents.set(tail, content)
    })
  }
  return contents
}

const assertBundledPackage = (
  tt: Test,
  mapFile: string,
  pkgName: string,
  minVersion: string,
) => {
  const map = JSON.parse(readFileSync(mapFile, 'utf8')) as SourceMap
  const needle = `/node_modules/${pkgName}/`
  const bundled = map.sources
    .map((source, i) => ({ source: posix(source), i }))
    .filter(({ source }) => source.includes(needle))

  tt.ok(bundled.length, `default bundle includes ${pkgName}`)
  const first = bundled[0]
  if (!first) return

  const pkg = packageFromSource(mapFile, first.source)
  tt.equal(pkg.name, pkgName, `resolved ${pkgName} package.json`)
  tt.ok(
    gte(pkg.version, minVersion),
    `${pkgName}@${pkg.version} is at least ${minVersion}`,
  )

  const expected = installedSourceContents(pkg.root)
  for (const { source, i } of bundled) {
    const after = source.split(needle)[1] ?? ''
    const key = after.split('/').slice(-2).join('/')
    const fromBundle = map.sourcesContent?.[i]
    const fromInstall = expected.get(key)
    tt.ok(fromBundle, `${pkgName} ${key} is in the bundle source map`)
    tt.ok(
      fromInstall,
      `${pkgName} ${key} is in the installed package maps`,
    )
    tt.equal(
      fromBundle,
      fromInstall,
      `${pkgName} ${key} matches the installed package`,
    )
  }
}

t.test('default bundles include current patched matcher deps', t => {
  for (const rel of [
    'dist/esm/index.min.js.map',
    'dist/commonjs/index.min.js.map',
  ]) {
    t.test(rel, tt => {
      const mapFile = join(repoRoot, rel)
      assertBundledPackage(tt, mapFile, 'minimatch', MIN_MINIMATCH)
      assertBundledPackage(
        tt,
        mapFile,
        'brace-expansion',
        MIN_BRACE_EXPANSION,
      )
      tt.end()
    })
  }
  t.end()
})
