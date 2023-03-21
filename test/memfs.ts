import { fs as memfs, vol } from 'memfs'
import t from 'tap'
import { glob } from '../'
t.beforeEach(() => vol.fromJSON({ '/x': 'abc' }))

const fs = memfs as unknown as typeof import('fs')

t.test('should match single file with pattern', async t => {
  const expandedFiles = await glob(['.', '/**/*'], { nodir: true, fs })
  t.strictSame(expandedFiles, ['/x'])
})

t.test('should match single file without pattern', async t => {
  const expandedFiles = await glob(['.', '/x'], { nodir: true, fs })
  t.strictSame(expandedFiles, ['/x'])
})
