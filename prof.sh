#!/bin/bash
export CDPATH=
set -e

tmp=${TMPDIR:-/tmp}
bash make-benchmark-fixture.sh
wd=$PWD
cd $tmp/benchmark-fixture

node --prof -e '
  var glob=require(process.argv[1]);
  glob("**/*.txt").then(function (files) {
    console.log(files.length)
  })
  //console.log(glob.sync("**/*.txt").length);
  ' "$wd"
rm "$wd/v8.log"
mv *v8.log "$wd/v8.log"
cd "$wd"
node --prof-process v8.log > profile.txt
