#!/bin/bash
export CDPATH=
set -e
set -x

tmp=${TMPDIR:-/tmp}
bash -x make-benchmark-fixture.sh
wd=$PWD
cd "$tmp/benchmark-fixture"

export __GLOB_PROFILE__=1

cat > "profscript.mjs" <<MJS
import glob from '$wd/dist/mjs/index.js'
console.log(glob.sync("**/*/*.txt").length);
MJS

node "$tmp/benchmark-fixture/profscript.mjs"
