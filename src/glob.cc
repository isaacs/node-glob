// exposes the glob function to node.

// int
// glob(const char *restrict pattern, int flags,
//     int (*errfunc)(const char *epath, int errno), glob_t *restrict pglob);

#include <v8.h>
#include <glob.h>
#include <node.h>

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


class Glob : public ObjectWrap {
  static Persistent<FunctionTemplate> ctor;
public:
  glob_t g;
  Glob (glob_t gg) : g(gg) {}
  virtual ~Glob () {
    globfree(&g);
  }
  static void Initialize (Handle<Object> target) {
    HandleScope scope;
    Local<FunctionTemplate> t = FunctionTemplate::New(New);
    ctor = Persistent<FunctionTemplate>::New(t);
    ctor->InstanceTemplate()->SetInternalFieldCount(1);
    ctor->SetClassName(String::NewSymbol("glob_t"));
    target->Set(String::NewSymbol("glob_t"), ctor->GetFunction());
  }
  static Handle<Value> New(const Arguments &args) {
    HandleScope scope;
    glob_t gg;
    Glob *self = new Glob(gg);
    self->Wrap(args.This());
    return scope.Close(args.This());
  }

  // async EIO globbing
  struct glob_request {
    Persistent<Function> cb;
    Glob *GT;
    int retval;
    int flags;
    char *pattern;
  };
  static int EIO_Glob (eio_req *req) {
    glob_request *gr = (glob_request *)req->data;
    gr->retval = glob(gr->pattern, gr->flags, NULL, &(gr->GT->g));
    return 0;
  }
  static int EIO_GlobAfter (eio_req *req) {
    HandleScope scope;
    ev_unref(EV_DEFAULT_UC);
    glob_request *gr = (glob_request *)req->data;
    Glob *GT = gr->GT;
    glob_t *g = &(GT->g);

    Local<Value> argv[2];
    if (gr->retval != 0) {
      argv[0] = Exception::Error(GlobError(gr->retval));
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
    GT->Unref();
    gr->cb.Dispose();
    free(gr);
    return 0;
  }
  static Handle<Value> GlobAsync (const Arguments& args) {
    HandleScope scope;
    const char *usage = "usage: glob(pattern, flags, globt, cb)";

    if (args.Length() != 4) {
      Throw(usage);
    }

    String::Utf8Value pattern(args[0]);
    int flags = args[1]->Int32Value();
    Glob *GT = ObjectWrap::Unwrap<Glob>(args[2]->ToObject());
    Local<Function> cb = Local<Function>::Cast(args[3]);

    glob_request *gr = (glob_request *)malloc(sizeof(glob_request));
    gr->cb = Persistent<Function>::New(cb);
    gr->pattern = *pattern;
    gr->flags = flags;
    gr->GT = GT;
    GT->Ref();
    eio_custom(EIO_Glob, EIO_PRI_DEFAULT, EIO_GlobAfter, gr);
    ev_ref(EV_DEFAULT_UC);

    return Undefined();
  }
  
  // synchronous globbing.
  static Handle<Value> GlobSync (const Arguments& args) {
    HandleScope scope;
    const char * usage = "usage: globSync(pattern, flags, globt)";
    if (args.Length() != 3) {
      return Throw(usage);
    }

    String::Utf8Value pattern(args[0]);

    int flags = args[1]->Int32Value();

    Glob *GT = ObjectWrap::Unwrap<Glob>(args[2]->ToObject());
    glob_t *g = &(GT->g);
    int retval = glob(*pattern, flags, NULL, g);

    if (retval != 0) {
      return Throw(retval);
    }

    // create a JS array
    // loop through the g->gl_pathv adding JS strings to the JS array.
    // then return the JS array.
    Handle<Array> pathv = Array::New(g->gl_pathc);
    for (int i = 0; i < g->gl_pathc; i ++) {
      pathv->Set(Integer::New(i), String::New(g->gl_pathv[i]));
    }

    return pathv;
  }
};


Persistent<FunctionTemplate> Glob::ctor;
extern "C" void
init (Handle<Object> target) 
{
  HandleScope scope;
  NODE_SET_METHOD(target, "glob", Glob::GlobAsync);
  NODE_SET_METHOD(target, "globSync", Glob::GlobSync);
  Glob::Initialize(target);
  GlobConstants(target);
}

