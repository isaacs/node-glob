#!/bin/bash
export CDPATH=
set -e
set -x

. patterns.sh

bash -x make-benchmark-fixture.sh
wd=$PWD
tmp="$wd/bench-working-dir"
cd "$tmp"

export __GLOB_PROFILE__=1

cat > "profscript.mjs" <<MJS
import { glob } from '$wd/dist/mjs/index.js'
const patterns = process.argv.slice(2)
for (const p of patterns) {
  glob.sync("./fixture/" + p)
}
await Promise.all(patterns.map(async p => {
  await glob("./fixture/" + p)
}))
MJS

node --prof profscript.mjs "${patterns[@]}" &> profile.out
mkdir -p profiles
d=./profiles/$(date +%s)
mv isolate*.log ${d}.log
node --prof-process ${d}.log > ${d}.txt
cp ${d}.txt ../profile.txt
#cat ${d}.txt
