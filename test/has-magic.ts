import { assert, test } from 'ubqtest'
import { fileURLToPath } from 'url'
import { glob } from '../dist/esm/index.js'

process.chdir(fileURLToPath(new URL('.', import.meta.url)))

test('non-string pattern is evil magic', async () => {
  const patterns = [0, null, 12, { x: 1 }, undefined, /x/, NaN]
  patterns.forEach(function (p) {
    assert.throws(function () {
      // @ts-expect-error
      glob.hasMagic(p)
    }, Error)
  })
})

test('detect magic in glob patterns', async () => {
  assert(!glob.hasMagic(['']), "no magic in ''")
  assert(!glob.hasMagic('a/b/c/'), 'no magic a/b/c/')
  assert(glob.hasMagic('a/b/**/'), 'magic in a/b/**/')
  assert(glob.hasMagic('a/b/?/'), 'magic in a/b/?/')
  assert(glob.hasMagic('a/b/+(x|y)'), 'magic in a/b/+(x|y)')
  assert(
    !glob.hasMagic('a/b/+(x|y)', { noext: true }),
    'no magic in a/b/+(x|y) noext',
  )
  assert(!glob.hasMagic('{a,b}'), 'no magic in {a,b}')
  assert(
    glob.hasMagic('{a,b}', { magicalBraces: true }),
    'magical braces are magic in {a,b}',
  )
  assert(
    !glob.hasMagic('{a,b}', { nobrace: true }),
    'no magic in {a,b} nobrace:true',
  )
  assert(
    !glob.hasMagic('{a,b}', { nobrace: true, magicalBraces: true }),
    'magical braces not magic in {a,b} nobrace:true',
  )
})
