Any change to behavior (including bugfixes) must come with a test.

Patches that fail tests or reduce performance will be rejected.

```sh
# to run tests
npm test

# to re-generate test fixtures
npm run test-regen

# to benchmark against bash/zsh
npm run bench

# to benchmark in a Docker container that is limited to 4 CPUs and
# 8GB of memory, a few times, and print the medians
npm run bench:docker

# to profile javascript
npm run prof
```
