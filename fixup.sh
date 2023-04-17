#!/usr/bin/env bash

cat >dist/cjs/package.json <<!EOF
{
  "version": "$(node -p 'require("./package.json").version')",
  "type": "commonjs"
}
!EOF

cat >dist/mjs/package.json <<!EOF
{
  "version": "$(node -p 'require("./package.json").version')",
  "type": "module"
}
!EOF

chmod 0755 dist/cjs/src/bin.js
