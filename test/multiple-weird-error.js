const t = require('tap')
const fs = require('fs')
const expected = new Error('expected')
fs.readdir = (path, cb) => cb(expected)
const glob = require('../')

// also test that silent:true is actually silent!
console.error = function () { throw 'SILENCE, INSECT!' }

t.plan(3)
t.rejects(() => glob('*', { silent: true }), expected)
t.rejects(() => glob('*', { silent: true, strict: true }), expected)
t.resolves(() => glob('*', { silent: true, strict: false }))
