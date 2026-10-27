#!/bin/bash
# Run benchmark.sh in the bench:docker container a number of times,
# and print the median of each result.
#
# usage: bash bench-docker/run.sh [runs]

set -e
runs=${1:-3}
cd /glob

for i in $(seq 1 "$runs"); do
  echo "run $i of $runs" >&2
  if ! bash benchmark.sh >"/tmp/bench.$i.txt" 2>"/tmp/bench.$i.err"; then
    cat "/tmp/bench.$i.err" >&2
    exit 1
  fi
done

node bench-docker/summary.mjs /tmp/bench.*.txt
