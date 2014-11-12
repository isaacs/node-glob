#!/bin/bash
export CDPATH=
set -e
if ! [ -d benchmark-fixture ]; then
  echo Making benchmark fixtures
  mkdir benchmark-fixture
  cd benchmark-fixture
  dirnames=`echo {0..9}/{0..9}/{0..9}/{0..9}` # 10000 dirs
  filenames=`echo {0..9}/{0..9}/{0..9}/{0..9}/{0..9}.txt`
  echo $dirnames | xargs mkdir -p
  echo $filenames | xargs touch
fi
