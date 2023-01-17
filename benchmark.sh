#!/bin/bash
export CDPATH=
set -e

tmp=${TMPDIR:-/tmp}
bash make-benchmark-fixture.sh
wd=$PWD
cd $tmp/benchmark-fixture

tt () {
  time "$@"
}

t () {
  tt "$@" 2>&1 | grep real | awk -F $'\t' '{ print $2 }'
}

if [[ "`bash --version`" =~ version\ 4 ]] || [[ "`bash --version`" =~ version\ 5 ]]; then
  echo -n $'bash                        \t'
  t bash -c 'shopt -s globstar; echo **/*.txt | wc -w'
fi

if type zsh &>/dev/null; then
  echo -n $'zsh                         \t'
  t zsh -c 'echo **/*.txt | wc -w'
fi

echo -n $'node raw                      \t'
t node -e '
  var fs=require("fs");
  var count = 0;
  function walk (path) {
    if (path.slice(-4) === ".txt") count++;
    var stat = fs.statSync(path);
    if (stat.isDirectory()) {
      fs.readdirSync(path).forEach(function(entry) {
        walk(path + "/" + entry);
      })
    }
  }
  walk(".");
  console.log(count)'

mkdir -p "$wd/old"
cat > "$wd/old/package.json" <<PJ
{
  "dependencies": {
    "glob7": "npm:glob@7",
    "glob8": "npm:glob@8"
  }
}
PJ
(cd "$wd/old" &>/dev/null; npm i --silent)

echo -n $'node glob v7 sync             \t'
t node -e '
  var glob=require(process.argv[1])
  console.log(glob.sync("**/*.txt").length)
' "$wd/old/node_modules/glob7"

echo -n $'node glob v7 async            \t'
t node -e '
  var glob=require(process.argv[1])
  glob("**/*.txt", (er, files) => {
    console.log(files.length)
  })' "$wd/old/node_modules/glob7"

echo -n $'node glob v8 sync             \t'
t node -e '
  var glob=require(process.argv[1])
  console.log(glob.sync("**/*.txt").length)
' "$wd/old/node_modules/glob8"

echo -n $'node glob v8 async            \t'
t node -e '
  var glob=require(process.argv[1])
  glob("**/*.txt", (er, files) => {
    console.log(files.length)
  })' "$wd/old/node_modules/glob8"

echo -n $'node current glob.sync cjs    \t'
cat > "$wd/old/sync.cjs" <<CJS
const glob = require("$wd/dist/cjs/index-cjs.js")
console.log(glob.sync("**/*.txt").length)
CJS
t node "$wd/old/sync.cjs"

echo -n $'node current glob async cjs   \t'
cat > "$wd/old/async.cjs" <<CJS
const glob = require("$wd/dist/cjs/index-cjs.js")
glob("**/*.txt").then(files => console.log(files.length))
CJS
t node "$wd/old/async.cjs"

echo -n $'node current glob.sync mjs    \t'
cat > "$wd/old/sync.mjs" <<MJS
import glob from '$wd/dist/mjs/index.js'
console.log(glob.sync("**/*.txt").length)
MJS
t node "$wd/old/sync.mjs"

echo -n $'node current glob async mjs   \t'
cat > "$wd/old/async.mjs" <<MJS
import glob from '$wd/dist/mjs/index.js'
glob("**/*.txt").then(files => console.log(files.length))
MJS
t node "$wd/old/async.mjs"

echo -n $'node current glob async cjs -e\t'
t node -e '
require(process.argv[1])("**/*.txt").then((files) => console.log(files.length))
' "$wd/dist/cjs/index-cjs.js"

echo -n $'node current glob sync cjs -e \t'
t node -e '
console.log(require(process.argv[1]).sync("**/*.txt").length)
' "$wd/dist/cjs/index-cjs.js"
