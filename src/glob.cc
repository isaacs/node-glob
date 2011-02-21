// exposes the glob function to node.

// int
// glob(const char *restrict pattern, int flags,
//     int (*errfunc)(const char *epath, int errno), glob_t *restrict pglob);

#include <glob.h>
#include <fnmatch.h>
#include <v8.h>
#include <node.h>
#include <string.h>
#include <stdlib.h>
#include "glob_constants.h"

using namespace std;
using namespace node;
using namespace v8;



static Handle<String>
GlobError (int er) {
  switch (er) {
    case GLOB_ABORTED: return String::New("GLOB_ABORTED"); break;
    case GLOB_NOMATCH: return String::New("GLOB_NOMATCH"); break;
    case GLOB_NOSPACE: return String::New("GLOB_NOSPACE"); break;
  }

  return String::New("undefined glob error");
}


static Handle<Value> Throw (int);
static Handle<Value> Throw (const char*);
static Handle<Value> Throw (Handle<String>);

static Handle<Value>
Throw (int msg) {
  return Throw(GlobError(msg));
}
static Handle<Value>
Throw (const char* msg) {
  return Throw(String::New(msg));
}
static Handle<Value>
Throw (Handle<String> msg) {
  ThrowException(Exception::Error(msg));
}


// binding to fnmatch
// Not really glob-specific, but useful if you're doing globbing.
// int fnmatch(const char *pattern, const char *string, int flags);
static Handle<Value> FNMatch (const Arguments& args) {
  if (args.Length() != 3) return Throw(
    "usage: fnmatch(pattern, string, flags)");

  String::Utf8Value pattern(args[0]);
  String::Utf8Value str(args[1]);
  int flags = args[2]->Int32Value();

  int res = fnmatch(*pattern, *str, flags);

  return Integer::New(res);
}


// async EIO globbing
struct glob_request {
  Persistent<Function> cb;
  glob_t *g;
  int retval;
  int flags;
  char pattern[1];
};
static int EIO_Glob (eio_req *req) {
  glob_request *gr = (glob_request *)req->data;
  gr->retval = myglob(gr->pattern, gr->flags, NULL, gr->g);
  return 0;
}
static int EIO_GlobAfter (eio_req *req) {
  HandleScope scope;
  ev_unref(EV_DEFAULT_UC);
  glob_request *gr = (glob_request *)req->data;
  glob_t *g = gr->g;

  Local<Value> argv[2];
  if (gr->retval != 0) {
    argv[0] = Exception::Error(GlobError(gr->retval));
    argv[1] = String::New(gr->pattern);
  } else {
    Local<Array> pathv = Array::New(g->gl_pathc);
    for (int i = 0; i < g->gl_pathc; i ++) {
      pathv->Set(Integer::New(i), String::New(g->gl_pathv[i]));
    }
    argv[0] = Local<Value>::New(Null());
    argv[1] = pathv;
  }

  TryCatch try_catch;
  gr->cb->Call(Context::GetCurrent()->Global(), 2, argv);
  if (try_catch.HasCaught()) {
    FatalException(try_catch);
  }
  gr->cb.Dispose();
  myglobfree(g);
  free(gr);
  return 0;
}
static Handle<Value> GlobAsync (const Arguments& args) {
  HandleScope scope;
  const char *usage = "usage: glob(pattern, flags, cb)";

  if (args.Length() != 3) {
    Throw(usage);
  }

  String::Utf8Value pattern(args[0]);

  int flags = args[1]->Int32Value();
  Local<Function> cb = Local<Function>::Cast(args[2]);

  glob_request *gr = (glob_request *)
    calloc(1, sizeof(struct glob_request) + pattern.length() + 1);

  gr->cb = Persistent<Function>::New(cb);
  strncpy(gr->pattern, *pattern, pattern.length() + 1);
  gr->flags = flags;
  gr->g = new glob_t;
  eio_custom(EIO_Glob, EIO_PRI_DEFAULT, EIO_GlobAfter, gr);
  ev_ref(EV_DEFAULT_UC);

  return Undefined();
}

// synchronous globbing.
static Handle<Value> GlobSync (const Arguments& args) {
  HandleScope scope;
  const char * usage = "usage: globSync(pattern, flags)";
  if (args.Length() != 2) {
    return Throw(usage);
  }

  String::Utf8Value pattern(args[0]);

  int flags = args[1]->Int32Value();

  glob_t g;
  fprintf(stderr, "about to glob\n");
  int retval = myglob(*pattern, flags, NULL, &g);
  fprintf(stderr, "Back from glob with %i\n", retval);

  if (retval != 0) {
    fprintf(stderr, "about to globfree %i\n", &g);
    if (retval != GLOB_NOSPACE) myglobfree(&g);
    return Throw(retval);
  }

  // create a JS array
  // loop through the g.gl_pathv adding JS strings to the JS array.
  // then return the JS array.
  Handle<Array> pathv = Array::New(g.gl_pathc);
  for (int i = 0; i < g.gl_pathc; i ++) {
    pathv->Set(Integer::New(i), String::New(g.gl_pathv[i]));
  }

  myglobfree(&g);
  return scope.Close(pathv);
}


extern "C" void
init (Handle<Object> target)
{
  HandleScope scope;
  GlobConstants(target);
  NODE_SET_METHOD(target, "glob", GlobAsync);
  NODE_SET_METHOD(target, "globSync", GlobSync);
  NODE_SET_METHOD(target, "fnmatch", FNMatch);
}

