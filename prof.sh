#!/bin/bash
export CDPATH=
set -e

bash make-benchmark-fixture.sh
cd benchmark-fixture

node --prof -e '
  var glob=require("../");
  glob("**/*.txt", function (er, files) {
    console.log(files.length)
  })
  //console.log(glob.sync("**/*.txt").length);
  '
mv v8.log ..
cd ..
node-tick-processor > profile.txt
