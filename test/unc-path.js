var test = require('tap').test;
var glob = require('../');
var fs = require('fs');
var path = require('path');
var skip = false
if (/^v0\.(10|[0-9])\./.test(process.version)) {
  skip = 'Does not work on Node < 0.12'
}

test('glob doesn\'t choke on UNC paths', { skip: skip }, function(t) {
  stubPlatform('win32', function(restorePlatform) {
    var readdir = fs.readdir;

    fs.readdir = function(path, cb) {
      if (path === '\\\\vmware-share\\share-name\\baz') {
        return cb(undefined, [
          'some-file.txt',
          'some-other-file.txt'
        ])
      }

      readdir(path, cb)
    }

    var results = glob('\\\\vmware-share\\share-name\\baz\\*', function (er, results) {
      restorePlatform();

      if (er)
        throw er

      t.same(results, [
        '\\\\vmware-share\\share-name\\baz\\some-file.txt',
        '\\\\vmware-share\\share-name\\baz\\some-other-file.txt'
      ])

      t.end()
    }, { platform: 'win32' })
  })
})

function stubPlatform(platform, fn) {
  var descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  var path = require('path');
  var join = path.join;
  var normalize = path.normalize;
  var sep = path.sep;
  var resolve = path.resolve;
  var isAbsolute = require('path-is-absolute');

  function restore() {
    path.resolve = resolve;
    path.sep = sep;
    path.join = join;
    path.normalize = normalize;
    var isAbsolute = require('path-is-absolute');
    Object.defineProperty(process, 'platform', descriptor);
  }

  try {
    Object.defineProperty(process, 'platform', {
      value: platform,
      writable: false
    });

    path.sep = '\\';
    path.resolve = path[platform].resolve;
    path.join = path.win32.join;
    path.normalize = path.win32.normalize;

    return fn(restore);
  } catch(e) {
    restore();
    throw e;
  }
}
