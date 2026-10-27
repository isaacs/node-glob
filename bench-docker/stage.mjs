// Copy the built glob package, and the packages that it needs at run
// time, into a folder that can be a Docker build context.
//
// Only the `dependencies` of each package are followed, and only its
// published files (package.json and its `files` list) are copied, so
// that a package that is linked to a local checkout does not bring
// its dev dependencies or sources with it. Each dependency is found
// the same way that Node finds it, from the folder of the package
// that needs it.
//
// usage: node bench-docker/stage.mjs <dest>

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
} from 'fs'
import { dirname, join, relative, resolve, sep } from 'path'

const dest = process.argv[2]
if (!dest) throw new Error('usage: stage.mjs <dest>')

const readPkg = dir =>
  JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))

// the real folder of the package `name`, as Node finds it from `from`
const find = (name, from) => {
  for (let d = from; ; d = dirname(d)) {
    const pj = join(d, 'node_modules', name, 'package.json')
    if (existsSync(pj)) return realpathSync(dirname(pj))
    if (dirname(d) === d)
      throw new Error(`cannot find ${name} from ${from}`)
  }
}

// copy the published files of the package in `src` to `to`
const copyPkg = (src, to) => {
  mkdirSync(to, { recursive: true })
  const pkg = readPkg(src)
  cpSync(join(src, 'package.json'), join(to, 'package.json'))
  const files = pkg.files ?? ['.']
  for (const f of files) {
    if (!existsSync(join(src, f))) continue
    cpSync(join(src, f), join(to, f), {
      recursive: true,
      dereference: true,
      // the package's own node_modules, not the one it is in
      filter: s => !relative(src, s).split(sep).includes('node_modules'),
    })
  }
}

// The packages are placed in the top level node_modules, unless a
// different copy with the same name is already there. Then it is
// placed in the node_modules of the package that needs it.
const placed = new Map()
const stage = (src, to, top) => {
  copyPkg(src, to)
  for (const name of Object.keys(readPkg(src).dependencies ?? {})) {
    const dep = find(name, src)
    const atTop = placed.get(name)
    if (atTop === dep) continue
    if (atTop === undefined) {
      placed.set(name, dep)
      stage(dep, join(top, 'node_modules', name), top)
    } else {
      stage(dep, join(to, 'node_modules', name), top)
    }
  }
}

const root = resolve(import.meta.dirname, '..')
stage(root, resolve(dest), resolve(dest))
for (const [name, dir] of placed) console.log(`${name} <- ${dir}`)
