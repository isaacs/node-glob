var WinPath = require('../common').WinPath;
var test = require('tap').test

test("UNIT: WinPath – basic path", function(t) {
  var path = new WinPath('basic-path')

  t.same(path.device, '');
  t.same(path.sep, '');
  t.same(path.tail, 'basic-path')

  t.end();
});

test("UNIT: WinPath – relative path", function(t) {
  var path = new WinPath('relative\\path')

  t.same(path.device, '');
  t.same(path.sep, '');
  t.same(path.tail, 'relative\\path')

  t.end();
});

test("UNIT: WinPath – relative path \w glob", function(t) {
  var path = new WinPath('relative\\path\\*')

  t.same(path.device, '');
  t.same(path.sep, '');
  t.same(path.tail, 'relative\\path\\*')

  t.end();
});

test("UNIT: WinPath – absolute path", function(t) {
  var path = new WinPath('\\relative\\path')

  t.same(path.device, '');
  t.same(path.sep, '\\');
  t.same(path.tail, 'relative\\path')

  t.end();
});

test("UNIT: WinPath – absolute path \w glob", function(t) {
  var path = new WinPath('\\relative\\path\\*')

  t.same(path.device, '');
  t.same(path.sep, '\\');
  t.same(path.tail, 'relative\\path\\*')

  t.end();
});

test("UNIT: WinPath – UNC path", function(t) {
  var path = new WinPath('\\\\vmware-share\\share-name\\relative\\path')

  t.same(path.device, '\\\\vmware-share\\share-name');
  t.same(path.sep, '\\');
  t.same(path.tail, 'relative\\path')

  t.end();
});

test("UNIT: WinPath – UNC path \w glob", function(t) {
  var path = new WinPath('\\\\vmware-share\\share-name\\relative\\path\\*')

  t.same(path.device, '\\\\vmware-share\\share-name');
  t.same(path.sep, '\\');
  t.same(path.tail, 'relative\\path\\*')

  t.end();
});
