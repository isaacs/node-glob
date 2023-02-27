#!/bin/bash

wd=$PWD
mkdir -p "$wd/bench-working-dir/fixture"
tmp="$wd/bench-working-dir/fixture"
export CDPATH=
set -e
if ! [ -d "$tmp/0" ]; then
  echo Making benchmark fixtures
  mkdir -p "$tmp"
  cd "$tmp"
  dirnames=`echo {0..9}/{0..9}/{0..9}/{0..9}` # 10000 dirs
  filenames=`echo {0..9}/{0..9}/{0..9}/{0..9}/{0..9}.txt`
  echo $dirnames | xargs mkdir -p
  echo $filenames | xargs touch
  # add 10k more that are not single chars
  for i in {0..9}; do
    for j in {0..9}; do
      for k in {0..9}; do
        for l in {0..9}; do
          mkdir -p "$i$i$i$i/$j$j$j$j/$k$k$k$k/$l$l$l$l"
          for m in {0..9}; do
            touch "$i$i$i$i/$j$j$j$j/$k$k$k$k/$l$l$l$l/$m$m$m$m.txt"
          done
        done
      done
    done
  done
fi
