#!/bin/bash
export CDPATH=
set -e

. patterns.sh

bash make-benchmark-fixture.sh
wd=$PWD

mkdir -p "$wd/bench-working-dir/fixture"
cd "$wd/bench-working-dir"
cat > "$wd/bench-working-dir/package.json" <<PJ
{
  "dependencies": {
    "fast-glob": "3",
    "glob7": "npm:glob@7",
    "glob8": "npm:glob@8",
    "globby": "13"
  }
}
PJ

if ! [ -d "$wd/bench-working-dir/node_modules/glob7" ] || \
    ! [ -d "$wd/bench-working-dir/node_modules/glob8" ] || \
    ! [ -d "$wd/bench-working-dir/node_modules/globby" ]; then
  (cd "$wd/bench-working-dir" &>/dev/null; npm i --silent)
fi

tt () {
  time "$@"
}

t () {
  rm -f stderr stdout
  tt "$@" 2>stderr >stdout || (cat stderr >&2 ; exit 1 )
  echo $(cat stderr | grep real | awk -F $'\t' '{ print $2 }' || true)' '\
    $(cat stdout)
  # rm -f stderr stdout
}

# warm up the fs cache so we don't get a spurious slow first result
bash -c 'for i in **; do :; done'


for p in "${patterns[@]}"; do
  echo
  echo "--- pattern: '$p' ---"

  # if [[ "`bash --version`" =~ version\ 4 ]] || [[ "`bash --version`" =~ version\ 5 ]]; then
  #   echo -n $'bash                        \t'
  #   t bash -c 'shopt -s globstar; echo '"$p"' | wc -w'
  # fi

  # if type zsh &>/dev/null; then
  #   echo -n $'zsh                         \t'
  #   t zsh -c 'echo '"$p"' | wc -w'
  # fi

  # echo -n $'node glob v7 sync             \t'
  # t node -e '
  #   var glob=require(process.argv[1])
  #   console.log(glob.sync(process.argv[2]).length)
  # ' "$wd/bench-working-dir/node_modules/glob7" "$p"

  # echo -n $'node glob v7 async            \t'
  # t node -e '
  #   var glob=require(process.argv[1])
  #   glob(process.argv[2], (er, files) => {
  #     console.log(files.length)
  #   })' "$wd/bench-working-dir/node_modules/glob7" "$p"

  echo '~~ sync ~~'

  echo -n $'node fast-glob sync           \t'
  cat > "$wd"/bench-working-dir/fast-glob-sync.cjs <<CJS
    const fg = require('fast-glob')
    console.log(fg.sync([process.argv[2]]).length)
CJS
  t node "$wd/bench-working-dir/fast-glob-sync.cjs" "$p"

  echo -n $'node globby sync              \t'
  cat > "$wd"/bench-working-dir/globby-sync.mjs <<MJS
    import { globbySync } from "globby"
    console.log(globbySync([process.argv[2]]).length)
MJS
  t node "$wd/bench-working-dir/globby-sync.mjs" "$p"

#  echo -n $'node current globSync cjs    \t'
#  cat > "$wd/bench-working-dir/sync.cjs" <<CJS
#  const {globSync} = require("$wd/dist/cjs/index-cjs.js")
#  console.log(globSync(process.argv[2]).length)
#CJS
#  t node "$wd/bench-working-dir/sync.cjs" "$p"
#
#  echo -n $'node current glob async cjs   \t'
#  cat > "$wd/bench-working-dir/async.cjs" <<CJS
#  const glob = require("$wd/dist/cjs/index-cjs.js")
#  glob(process.argv[2]).then(files => console.log(files.length))
#CJS
#  t node "$wd/bench-working-dir/async.cjs" "$p"

#   echo -n $'node glob v8 sync             \t'
#   cat > "$wd/bench-working-dir/glob-8-sync.cjs" <<CJS
#     var glob=require('glob8')
#     console.log(glob.sync(process.argv[2]).length)
# CJS
#   t node "$wd/bench-working-dir/glob-8-sync.cjs" "$p"

  echo -n $'node current globSync mjs    \t'
  cat > "$wd/bench-working-dir/sync.mjs" <<MJS
  import {globSync} from '$wd/dist/mjs/index.js'
  console.log(globSync(process.argv[2]).length)
MJS
  t node "$wd/bench-working-dir/sync.mjs" "$p"

  echo -n $'node current glob syncStream  \t'
  cat > "$wd/bench-working-dir/stream-sync.mjs" <<MJS
  import {globStreamSync} from '$wd/dist/mjs/index.js'
  let c = 0
  globStreamSync(process.argv[2])
    .on('data', () => c++)
    .on('end', () => console.log(c))
MJS
  t node "$wd/bench-working-dir/stream-sync.mjs" "$p"

  echo '~~ async ~~'

  echo -n $'node fast-glob async          \t'
  cat > "$wd"/bench-working-dir/fast-glob-async.cjs <<CJS
    const fg = require('fast-glob')
    fg([process.argv[2]]).then(r => console.log(r.length))
CJS
  t node "$wd/bench-working-dir/fast-glob-async.cjs" "$p"

  echo -n $'node globby async             \t'
  cat > "$wd"/bench-working-dir/globby-async.mjs <<MJS
    import { globby } from "globby"
    globby([process.argv[2]]).then((files) => {
      console.log(files.length)
    })
MJS
  t node "$wd/bench-working-dir/globby-async.mjs" "$p"

#   echo -n $'node glob v8 async            \t'
#   cat > "$wd/bench-working-dir/glob-8-async.cjs" <<CJS
#     var glob=require('glob8')
#     glob(process.argv[2], (er, results) =>
#       console.log(results.length)
#     )
# CJS
#   t node "$wd/bench-working-dir/glob-8-async.cjs" "$p"

  echo -n $'node current glob async mjs   \t'
  cat > "$wd/bench-working-dir/async.mjs" <<MJS
  import { glob } from '$wd/dist/mjs/index.js'
  glob(process.argv[2]).then(files => console.log(files.length))
MJS
  t node "$wd/bench-working-dir/async.mjs" "$p"

  echo -n $'node current glob stream      \t'
  cat > "$wd/bench-working-dir/stream.mjs" <<MJS
  import {globStream} from '$wd/dist/mjs/index.js'
  let c = 0
  globStream(process.argv[2])
    .on('data', () => c++)
    .on('end', () => console.log(c))
MJS
  t node "$wd/bench-working-dir/stream.mjs" "$p"

  # echo -n $'node current glob sync cjs -e \t'
  # t node -e '
  # console.log(require(process.argv[1]).sync(process.argv[2]).length)
  # ' "$wd/dist/cjs/index-cjs.js" "$p"

  # echo -n $'node current glob async cjs -e\t'
  # t node -e '
  # require(process.argv[1])(process.argv[2]).then((files) => console.log(files.length))
  # ' "$wd/dist/cjs/index-cjs.js" "$p"

done
