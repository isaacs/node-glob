#!/bin/bash
export CDPATH=
set -e
set -x

bash -x make-benchmark-fixture.sh
wd=$PWD
tmp="$wd/bench-working-dir"
cd "$tmp"

export __GLOB_PROFILE__=1

cat > "profscript.mjs" <<MJS
import glob from '$wd/dist/mjs/index.js'
console.log(glob.sync("./fixture/**/*/**/*/**/*/**/*/**/*.txt").length)
glob("./fixture/**/*/**/*/**/*/**/*/**/*.txt").then(m => console.log(m.length))
MJS

node --prof profscript.mjs &> profile.out
mkdir -p profiles
d=./profiles/$(date +%s)
mv isolate*.log ${d}.log
node --prof-process ${d}.log > ${d}.txt
cp ${d}.txt ../profile.txt
#cat ${d}.txt
