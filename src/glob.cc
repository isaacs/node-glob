// exposes the glob function to node.

// int
// glob(const char *restrict pattern, int flags,
//     int (*errfunc)(const char *epath, int errno), glob_t *restrict pglob);

#include <v8.h>
#include <glob.h>
#include <node.h>
#include <string.h>

using namespace std;
using namespace node;
using namespace v8;

#include "glob_constants.h"


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
  gr->retval = glob(gr->pattern, gr->flags, NULL, gr->g);
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
  // fprintf(stderr, "EIO_GlobAfter about to free\n");
  gr->cb.Dispose();
  globfree(g);
  free(gr);
  // fprintf(stderr, "EIO_GlobAfter freed\n");
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
  int retval = glob(*pattern, flags, NULL, &g);

  if (retval != 0) {
    globfree(&g);
    return Throw(retval);
  }

  // create a JS array
  // loop through the g.gl_pathv adding JS strings to the JS array.
  // then return the JS array.
  Handle<Array> pathv = Array::New(g.gl_pathc);
  for (int i = 0; i < g.gl_pathc; i ++) {
    pathv->Set(Integer::New(i), String::New(g.gl_pathv[i]));
  }

  globfree(&g);
  return scope.Close(pathv);
}


extern "C" void
init (Handle<Object> target)
{
  HandleScope scope;
  GlobConstants(target);
  NODE_SET_METHOD(target, "glob", GlobAsync);
  NODE_SET_METHOD(target, "globSync", GlobSync);
}

