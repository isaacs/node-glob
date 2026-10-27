// Print the median of each result over several runs of benchmark.sh,
// in the same format, and the total time of each implementation over
// all of the patterns.
//
// usage: node bench-docker/summary.mjs <output file> ...

import { readFileSync } from 'fs'

const files = process.argv.slice(2)
// pattern -> section -> name -> [times], counts. A pattern can be in
// the list more than once, so they are keyed by their place in it.
const results = new Map()
for (const f of files) {
  let pattern = ''
  let n = 0
  let section = ''
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const p = line.match(/^--- pattern: '(.*)' ---$/)
    if (p) {
      pattern = `${n++}\0${p[1]}`
      continue
    }
    const s = line.match(/^~~ (.*) ~~$/)
    if (s) {
      section = s[1]
      continue
    }
    const r = line.match(/^(.+?)\s*\t(\d+)m([\d.]+)s\s+(\d+)/)
    if (!r || !pattern) continue
    const [, name, min, sec, count] = r
    const byName = results.get(pattern) ?? new Map()
    results.set(pattern, byName)
    const key = `${section}\0${name.trim()}`
    const row = byName.get(key) ?? { times: [], counts: new Set() }
    byName.set(key, row)
    row.times.push(Number(min) * 60 + Number(sec))
    row.counts.add(count)
  }
}

const median = a => {
  const s = [...a].sort((x, y) => x - y)
  return s[s.length >> 1]
}
const fmt = t => `${Math.floor(t / 60)}m${(t % 60).toFixed(3)}s`

const totals = new Map()
console.log(`median of ${files.length} runs\n`)
for (const [pattern, byName] of results) {
  console.log(`--- pattern: '${pattern.split('\0')[1]}' ---`)
  let section = ''
  for (const [key, { times, counts }] of byName) {
    const [sec, name] = key.split('\0')
    if (sec !== section) console.log(`~~ ${(section = sec)} ~~`)
    const m = median(times)
    totals.set(key, (totals.get(key) ?? 0) + m)
    const count =
      counts.size === 1 ? [...counts][0] : [...counts].join('/')
    console.log(`${name.padEnd(25)}\t${fmt(m)}  ${count}`)
  }
  console.log()
}
console.log('--- total of the medians ---')
for (const [key, t] of totals) {
  const [sec, name] = key.split('\0')
  console.log(`${`${name} (${sec})`.padEnd(36)}\t${t.toFixed(3)}s`)
}
