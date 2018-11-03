#!/usr/bin/env node

var glob = require('.')

process.argv.slice(2).forEach(function (arg) {
  glob.sync(arg).forEach(function (line) {
    console.log(line)
  })
})
