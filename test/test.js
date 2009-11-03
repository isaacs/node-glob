#!/usr/bin/env node

var path = require("path");
require.paths.unshift(path.join(path.dirname(path.dirname(__filename))));
process.mixin(process.fs, require("glob"));


[ "*/", "*/*", "foo/ba{r,z}"].forEach(function (glob) {
  log("glob! "+glob+"\n"+process.fs.glob(glob).wait().join("\n")+"\ndone")
});


function log (m) {
  process.stdio.writeError(m+"\n");
};