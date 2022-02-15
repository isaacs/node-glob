require("./global-leakage.js")
var test = require("tap").test
var glob = require("../")

test("glob", async t => {
  const dir = t.testdir({
    'packge.json': '{}',
    README: 'x',
  })
  const opt = {
    cwd: dir,
    nocase: true,
    mark: true
  }
  const files = await glob("README?(.*)", opt)
  t.same(files, ["README"])
  t.end()
})
