#!/usr/bin/env node

var PATH = require("path");

// these go particularly nice on process.fs.
// process.mixin(process.fs, require("node-glob"));

exports.match = function match (pattern, path) {
  path = path || process.cwd();
  var p = new process.Promise();
  process.fs.readdir(path)
    .addCallback(function (files) {
      p.emitSuccess(files.filter(function (f) { return pattern.exec(f) }));
    })
    .addErrback(function () {
      p.emitSuccess([]);
    });
  return p;
};

// glob is a bit different.
// because, you can do something like foo/*/bar/*
exports.glob = function glob (pattern, path) {
  path = path || process.cwd();
  if (pattern[0] === '/') path = '/';
  return new Globber(path, pattern).go();
};

function Globber (path, pattern) {
  this.promise = new process.Promise();
  this.queue = [];
  this.found = [];
  this.push(path, pattern);
};
Globber.prototype = {
  go : function () {
    var self = this;
    var current = this.shift();
    if (!current) return succeed(this.promise)(this.found);
    
    var pattern = current.pattern
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .replace(/\/+/g, '/')
      .split("/");
    var first = pattern.shift();
    var rest = PATH.join.apply(PATH, pattern);
    
    exports.globShallow(first, current.path)
      .addCallback(function (matches) {
        // if (!matches.length) self.promise.;
        matches.forEach(function (match) {
          match = PATH.join(current.path, match);
          if (rest) self.push(match, rest);
          else self.save(match);
        });
        setTimeout(function () { self.go() });
      });
    
    return this.promise;
  },
  push : function (path, pattern) {
    this.queue.push({path:path, pattern:pattern});
  },
  shift : function () {
    return this.queue.shift();
  },
  save : function (path) {
    this.found.push(path);
  }
};

function succeed (promise) { return function () {
  var args = arguments;
  setTimeout(function () {
    promise.emitSuccess.apply(promise, args);
  });
  return promise;
}};


exports.globShallow = function globShallow (pattern, path) {
  var p = new process.Promise();
  if (!pattern) {
    setTimeout(function () { p.emitSuccess([]) });
    return p;
  }
  
  path = path || process.cwd();
  var cb = function (matches) {
    log("globShallow success: "+JSON.stringify(matches));
    p.emitSuccess(matches || []);
  };
  exports.match(globToRegex(pattern), path)
    .addCallback(cb).addErrback(cb);
  return p;
};

function globToRegex (glob) {
  var glob = glob.replace(/\/+/g, '/').split('/');
  var re = [];
  glob.forEach(function (g) {
    re.push(shallowGlobToRegex(g));
  });
  var pattern = "^" + re.join("/") + "$";
  
  log("globToRegex "+pattern);
  
  return new RegExp(pattern);
};


function shallowGlobToRegex (glob) {
  // first escape the regexp special chars that are not also glob special chars
  glob = glob.replace(
    // ][.+$^)(|
    /([\]\[\.\+\$\^\)\(\|])/g, '\\$1'
  );
  
  // replace {a,b,c} with (a|b|c),
  // but leave \{ and \} alone.
  var braceSetFinder = /(([^\\]|^)(\\{2})*)\{([^}{]*)\}/;
  var brace;
  while (brace = braceSetFinder.exec(glob)) {
    var braceReplace = brace[0].replace('{', '(').replace('}', ')').replace(',', '|');
    glob = glob.replace(brace[0], braceReplace);
  }
    
  // ? is like .
  glob = glob.replace(/(([^\\]|^)(\\{2})*)\\\?/, '$1\0ESCAPEDQ\0')
    .replace('?', '.')
    .replace('\0ESCAPEDQ\0', '\\?');
  
  // . is like \., but only if it's not alone.
  // It's already been escaped above, so this is basically unescaping it.
  glob = glob.replace(/^\\\.$/, '.');
  
  // replace * with .*
  // but not \*
  glob = glob.replace(/(([^\\]|^)(\\{2})*)\\\*/, '$1\0ESCAPEDSTAR\0')
    .replace('*', '.*')
    .replace('\0ESCAPEDSTAR\0', '\\*');

  log("shallowGlobToRegex "+glob);
  
  return glob;
};

function error (p) { return function () {
  p.emitError.apply(p, arguments);
}};

function log (m) {
  process.stdio.writeError("glob: "+m+"\n");
};