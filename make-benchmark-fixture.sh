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
fi
