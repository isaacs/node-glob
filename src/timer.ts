const profile = process.env.__GLOB_PROFILE__ === '1'
const times = new Map<string, number>()
if (profile) {
  process.on('exit', () => {
    const print = [...times.entries()].sort(
      ([_ak, av], [_bk, bv]) => av - bv
    )
    console.error(Object.fromEntries(print))
  })
}
export class Timer {
  name: string
  start: number
  constructor(name: string) {
    this.name = name
    this.start = profile ? performance.now() : 0
  }
  end() {
    if (profile) {
      const n = times.get(this.name) || 0
      times.set(this.name, n + performance.now() - this.start)
    }
  }
}
