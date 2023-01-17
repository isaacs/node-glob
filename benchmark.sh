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
  tt "$@" 2>&1 | grep real
}

set -e

if [[ "`bash --version`" =~ version\ 4 ]] || [[ "`bash --version`" =~ version\ 5 ]]; then
  echo Bash timing:
  t bash -c 'shopt -s globstar; echo **/*.txt | wc -w' | grep real
fi

echo
if type zsh &>/dev/null; then
  echo Zsh timing:
  t zsh -c 'echo **/*.txt | wc -w'
fi

echo

echo Node statSync and readdirSync timing:
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
  console.log(count)' | grep real
echo

mkdir -p "$wd/old/7"
echo '{"dependencies":{"glob":"7"}}' > "$wd/old/7/package.json"
(cd "$wd/old/7" &>/dev/null; npm i --silent)

echo Node glob v7 sync timing:
t node -e '
  var glob=require(process.argv[1])
  console.log(glob.sync("**/*.txt").length)
' "$wd/old/7/node_modules/glob" | grep real
echo

echo Node glob v7 async timing:
t node -e '
  var glob=require(process.argv[1])
  glob("**/*.txt", (er, files) => {
    console.log(files.length)
  })' "$wd/old/7/node_modules/glob" | grep real
echo

mkdir -p "$wd/old/8"
echo '{"dependencies":{"glob":"8"}}' > "$wd/old/8/package.json"
(cd "$wd/old/8" &>/dev/null; npm i --silent)

echo Node glob v8 sync timing:
t node -e '
  var glob=require(process.argv[1])
  console.log(glob.sync("**/*.txt").length)
' "$wd/old/8/node_modules/glob"
echo

echo Node glob v8 async timing:
t node -e '
  var glob=require(process.argv[1])
  glob("**/*.txt", (er, files) => {
    console.log(files.length)
  })' "$wd/old/8/node_modules/glob"
echo


echo Node current glob.sync timing:
t node -e '
  var glob=require(process.argv[1]);
  console.log(glob.sync("**/*.txt").length);' "$wd"
echo

echo Node current glob async timing:
t node -e '
  var glob=require(process.argv[1]);
  glob("**/*.txt").then((files) => {
    console.log(files.length)
  })' "$wd"
echo
