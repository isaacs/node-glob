#!/usr/bin/env node

const pf = require.resolve(`${process.cwd()}/package.json`)
const pj = require(pf)

if (!pj.repository && process.env.GITHUB_REPOSITORY) {
  const fs = require('fs')
  const server = process.env.GITHUB_SERVER_URL || 'https://github.com'
  const repo = `${server}/${process.env.GITHUB_REPOSITORY}`
  pj.repository = repo
  const json = fs.readFileSync(pf, 'utf8')
  const match = json.match(/^\s*\{[\r\n]+([ \t]*)"/)
  const indent = match[1]
  const output = JSON.stringify(pj, null, indent || 2) + '\n'
  fs.writeFileSync(pf, output)
}
