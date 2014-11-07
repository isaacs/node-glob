#!/bin/bash

mkdir benchmark.$$.tmp
cd benchmark.$$.tmp

(
  set -e

  echo Setting up...
  dirnames=`echo {0..9}/{0..9}/{0..9}/{0..9}` # 10000 dirs
  filenames=`echo {0..9}/{0..9}/{0..9}/{0..9}/{0..9}.txt`
  echo $dirnames | xargs mkdir -p
  echo $filenames | xargs touch
  echo

  if [[ "`bash --version`" =~ version\ 4 ]]; then
    echo Bash timing:
    time bash -c 'shopt -s globstar; echo **/*.txt | wc -w'
  fi

  echo
  if type zsh; then
    echo Zsh timing:
    time zsh -c 'echo **/*.txt | wc -w'
  fi

  echo

  echo Node statSync and readdirSync timing:
  time node -e '
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
  echo

  echo Node glob.sync timing:
  time node -e '
    var glob=require("../");
    console.log(glob.sync("**/*.txt").length);'
  echo

  echo Node glob async timing:
  time node -e '
    var glob=require("../");
    glob("**/*.txt", function (er, files) {
      console.log(files.length)
    })'
  echo
)

cd ..
rm -rf benchmark.$$.tmp
