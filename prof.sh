#!/bin/bash
export CDPATH=
set -e
set -x

tmp=${TMPDIR:-/tmp}
bash -x make-benchmark-fixture.sh
wd=$PWD
cd "$tmp/benchmark-fixture"

cat > "profscript.mjs" <<MJS
import glob from '$wd/dist/mjs/index.js'
console.log(glob.sync("**/*.txt").length);
// glob("**/*.txt").then((files) => {
//   console.log(files.length)
// })
MJS

node --prof "$tmp/benchmark-fixture/profscript.mjs"
mv *v8.log "$wd/v8.log"
cd "$wd"
node-tick-processor > profile.txt
