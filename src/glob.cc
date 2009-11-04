#include <v8.h>
#include <glob.h>
#include <node.h>
#include <iostream>

using namespace std;
using namespace v8;

int GlobError (const char *epath, int errno) {
  cerr << "error " << epath << " " << errno << "\n";
  return 1;
}

static Handle<Value>
NodeGlob (const Arguments& args)
{
  HandleScope scope;
  String::Utf8Value pattern(args[0]);
  
  cerr << "1\n";
  
  //TODO: if the path is undefined, then use the cwd
  // chdir here before doing the glob() below
  String::Utf8Value path(args[1]);

  cerr << "2\n";

  
  //TODO: do this with promises, not synchronous IO.
  
  // int
  // glob(const char *restrict pattern, int flags,
  //     int (*errfunc)(const char *epath, int errno), glob_t *restrict pglob);
  glob_t g;
  
  cerr << "3\n[" << *pattern << "]\n";
  
  
  int retval = glob(*pattern, 0, NULL, &g);
  
  cerr << "4\n";
  
  
  // return Integer::New(retval);
  
  if (retval != 0) {
    return Array::New(0);
  }
  
  
  
  // create a JS array
  // loop through the g.gl_pathv adding JS strings to the JS array.
  // then return the JS array.
  Handle<Array> pathv = Array::New(g.gl_pathc);
  cerr << "match count: " << g.gl_pathc << "\n";
  for (int i = 0; i < g.gl_pathc; i ++) {
    cerr << "found :" << g.gl_pathv[i] << "\n";
    pathv->Set(Integer::New(i), String::New(g.gl_pathv[i]));
  }
  globfree(&g);
  
  return pathv;
}

extern "C" void
init (Handle<Object> target) 
{
  HandleScope scope;
  target->Set(String::New("hello"), String::New("World"));
  
  NODE_SET_METHOD(target, "glob", NodeGlob);
}

