#include <v8.h>
#include <glob.h>
#include <node.h>
#include <iostream>

using namespace std;
using namespace v8;

int GlobError (const char *epath, int errno) {
  return 1;
}

static Handle<Value>
NodeGlob (const Arguments& args)
{
  HandleScope scope;
  String::Utf8Value pattern(args[0]);
  
  //TODO: if the path is undefined, then use the cwd
  // chdir here before doing the glob() below
  String::Utf8Value path(args[1]);

  //TODO: do this with promises, not synchronous IO.
  
  // int
  // glob(const char *restrict pattern, int flags,
  //     int (*errfunc)(const char *epath, int errno), glob_t *restrict pglob);
  glob_t g;
  
  
  int retval = glob(*pattern, 0, NULL, &g);
  
  // return Integer::New(retval);
  
  if (retval != 0) {
    return Array::New(0);
  }
  
  
  
  // create a JS array
  // loop through the g.gl_pathv adding JS strings to the JS array.
  // then return the JS array.
  Handle<Array> pathv = Array::New(g.gl_pathc);
  for (int i = 0; i < g.gl_pathc; i ++) {
    pathv->Set(Integer::New(i), String::New(g.gl_pathv[i]));
  }
  globfree(&g);
  
  return pathv;
}

extern "C" void
init (Handle<Object> target) 
{
  HandleScope scope;
  NODE_SET_METHOD(target, "glob", NodeGlob);
}

