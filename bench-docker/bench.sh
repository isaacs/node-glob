#!/bin/bash
# Run the benchmarks in a Docker container that is limited to a set
# number of CPUs and amount of memory, so that the results depend
# less on what else the machine is doing. The fixture is in a tmpfs
# in the container, so the results do not depend on the disk either.
# This is for comparing the implementations with each other: the
# times are for Linux in a container, and not for the host.
#
# The settings, and their defaults:
#   BENCH_RUNS=3    the number of times to run benchmark.sh. Each
#                   result is the median of the runs.
#   BENCH_CPUS=4    the number of CPUs that the container can use
#   BENCH_MEMORY=8g the memory that the container can use, with no
#                   swap

set -e
cd "$(dirname "$0")/.."

runs=${BENCH_RUNS:-3}
cpus=${BENCH_CPUS:-4}
memory=${BENCH_MEMORY:-8g}

npm run prepare >&2

# the build context: the built glob and its dependencies, and the
# benchmark scripts
ctx=$(mktemp -d)
trap '[ -n "$ctx" ] && rm -rf "$ctx"' EXIT
node bench-docker/stage.mjs "$ctx/glob" >&2
cp benchmark.sh patterns.sh make-benchmark-fixture.sh "$ctx/"
mkdir -p "$ctx/bench-docker"
cp bench-docker/run.sh bench-docker/summary.mjs "$ctx/bench-docker/"

docker build -q -t glob-bench -f bench-docker/Dockerfile "$ctx" >&2

docker run --rm \
  --cpus="$cpus" \
  --cpuset-cpus="0-$((cpus - 1))" \
  --memory="$memory" \
  --memory-swap="$memory" \
  --tmpfs /glob/bench-working-dir/fixture:rw,exec,size=2g,nr_inodes=1000000 \
  glob-bench "$runs"
