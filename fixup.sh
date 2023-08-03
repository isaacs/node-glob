#!/usr/bin/env bash

cat >dist-tmp/cjs/package.json <<!EOF
{
  "version": "$(node -p 'require("./package.json").version')",
  "type": "commonjs"
}
!EOF

cat >dist-tmp/mjs/package.json <<!EOF
{
  "version": "$(node -p 'require("./package.json").version')",
  "type": "module"
}
!EOF

sync-content dist-tmp dist
chmod 0755 dist/cjs/src/bin.js
rm -rf dist-tmp
