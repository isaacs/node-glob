# The image for `npm run bench:docker`. See bench-docker/bench.sh,
# which makes the build context.
# a set version of node, so that results can be compared over time
FROM node:26.12.1-bookworm-slim

# the other implementations that benchmark.sh compares against, in a
# layer before the glob code so that a rebuild does not install them
WORKDIR /glob/bench-working-dir
RUN npm init -y >/dev/null \
  && npm install --no-audit --no-fund --silent \
    fast-glob@3 glob7@npm:glob@7 glob8@npm:glob@8 globby@13

# the built glob package and its dependencies
WORKDIR /glob
COPY glob/ ./
COPY benchmark.sh patterns.sh make-benchmark-fixture.sh ./
COPY bench-docker/ bench-docker/

ENTRYPOINT ["bash", "bench-docker/run.sh"]
