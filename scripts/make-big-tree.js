#!/usr/bin/env node
const mkdirp = require('mkdirp')
const { readFileSync } = require('fs')
const { writeFile } = require('fs/promises')
const rimraf = require('rimraf')
const filesPerDir = 10
const dirsPerDir = 5
const max = (module === require.main && +process.argv[2]) || 1_000_000
const { now } = performance
let lastReported = now()

const report = s => {
  if (!process.stderr.isTTY) return
  process.stderr.write('\r' + s.padEnd(40))
}

let made = 0
const makeStep = async dir => {
  if (now() - lastReported > 250) report('growing: ' + made)
  const promises = []
  for (let i = 0; i < filesPerDir && made < max; i++) {
    made++
    promises.push(writeFile(`${dir}/${i}.txt`, ''))
  }
  await Promise.all(promises)

  const childDirs = []
  for (let i = 0; i < dirsPerDir && made < max; i++) {
    made++
    await mkdirp(`${dir}/${i}`)
    childDirs.push(makeStep(`${dir}/${i}`))
  }
  await Promise.all(childDirs)
}

const make = async root => {
  try {
    const already = +readFileSync(`${root}/bigtree.txt`)
    if (already === max) {
      console.log('already done!')
      return
    }
  } catch (_) {}
  report('chop down previous bigtree...')
  await rimraf(root + '/bigtree')
  report('creating bigtree...')
  report('\n')
  await mkdirp(root + '/bigtree')
  await makeStep(root + '/bigtree')
  await writeFile(`${root}/bigtree.txt`, `${max}`)
}

make(__dirname + '/fixture').then(() => {
  if (process.stderr.isTTY) process.stderr.write('\r'.padEnd(40) + '\r')
  console.log('done')
})
