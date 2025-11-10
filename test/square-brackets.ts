import t from 'tap'
import { glob } from '../dist/esm/index.js'

t.test('square brackets in folder names', async t => {
  // Set up test files in directories with square brackets
  const cwd = t.testdir({
    'app': {
      'api': {
        '[id]': {
          'route.spec.js': 'export const test = true;'
        },
        '[slug]': {
          'page.spec.js': 'export const test = true;'
        },
        'normal': {
          'file.spec.js': 'export const test = true;'
        }
      }
    }
  })

  t.test('escaped brackets should match literal brackets in folders', async t => {
    const results = await glob('app/api/\\[id\\]/*.spec.js', { cwd })
    t.equal(results.length, 1)
    t.match(results[0], /\[id\]\/route\.spec\.js$/)
  })

  t.test('unescaped brackets should not match literal bracket folders', async t => {
    const results = await glob('app/api/[id]/*.spec.js', { cwd })
    t.equal(results.length, 0)
  })

  t.test('wildcard should match all directories including bracketed ones', async t => {
    const results = await glob('app/api/*/*.spec.js', { cwd })
    t.equal(results.length, 3) // [id], [slug], and normal
  })

  t.test('globstar should find all spec files', async t => {
    const results = await glob('**/*.spec.js', { cwd })
    t.equal(results.length, 3)
  })

  t.test('literalBrackets option should auto-escape brackets', async t => {
    const results = await glob('app/api/[id]/*.spec.js', { cwd, literalBrackets: true })
    t.equal(results.length, 1)
    t.match(results[0], /\[id\]\/route\.spec\.js$/)
  })

  t.test('literalBrackets should work with multiple patterns', async t => {
    const patterns = ['app/api/[id]/*.spec.js', 'app/api/[slug]/*.spec.js']
    const results = await glob(patterns, { cwd, literalBrackets: true })
    t.equal(results.length, 2)
    t.match(results[0], /\[id\]\/route\.spec\.js$/)
    t.match(results[1], /\[slug\]\/page\.spec\.js$/)
  })

  t.test('literalBrackets should not affect normal brackets used as character classes', async t => {
    // Create files that would match character classes
    const testCwd = t.testdir({
      'i': { 'test.js': 'content' },
      'd': { 'test.js': 'content' },
      'normal': { 'test.js': 'content' }
    })
    
    // Without literalBrackets, [id] should match directories named 'i' or 'd'
    const results = await glob('[id]/test.js', { cwd: testCwd })
    t.equal(results.length, 2) // Should match 'i' and 'd' directories
    
    // With literalBrackets, [id] should be treated literally and match nothing
    const literalResults = await glob('[id]/test.js', { cwd: testCwd, literalBrackets: true })
    t.equal(literalResults.length, 0) // Should not match any directory
  })
})