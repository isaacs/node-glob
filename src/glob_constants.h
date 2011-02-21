#include <glob.h>
#include <fnmatch.h>
#include <v8.h>
#include <node.h>

using namespace node;
using namespace v8;

void
GlobConstants (Handle<Object> target) {
  // flags
  // These are defined in deps/fnmatch/fnmatch.h and deps/glob/glob.h

// these are actually useless, because the glob_t object isn't exposed
// to the javascript layer.  Since it's so trivial to concatenate
// arrays in JS anyway, it's a bit silly to even bother with this.
// NODE_DEFINE_CONSTANT(target, GLOB_APPEND);
// NODE_DEFINE_CONSTANT(target, GLOB_DOOFFS);

// this is useless as well, because there is no way to supply the errfunc
// function to glob().  It's just handled like the rest of node, passing
// an Error() obj to the cb.
// NODE_DEFINE_CONSTANT(target, GLOB_ERR);

// Not supported, since the glob_t object isn't exposed directly.
// NODE_DEFINE_CONSTANT(target, GLOB_ALTDIRFUNC);

NODE_DEFINE_CONSTANT(target, GLOB_MARK);
NODE_DEFINE_CONSTANT(target, GLOB_NOCHECK);
NODE_DEFINE_CONSTANT(target, GLOB_NOSORT);
NODE_DEFINE_CONSTANT(target, GLOB_NOESCAPE);

NODE_DEFINE_CONSTANT(target, GLOB_NOSPACE);
NODE_DEFINE_CONSTANT(target, GLOB_ABORTED);
NODE_DEFINE_CONSTANT(target, GLOB_NOMATCH);
NODE_DEFINE_CONSTANT(target, GLOB_NOSYS);

NODE_DEFINE_CONSTANT(target, GLOB_BRACE);
NODE_DEFINE_CONSTANT(target, GLOB_MAGCHAR);
NODE_DEFINE_CONSTANT(target, GLOB_NOMAGIC);
NODE_DEFINE_CONSTANT(target, GLOB_LIMIT);
NODE_DEFINE_CONSTANT(target, GLOB_TILDE);

NODE_DEFINE_CONSTANT(target, GLOB_PERIOD);
NODE_DEFINE_CONSTANT(target, GLOB_NO_DOTDIRS);
NODE_DEFINE_CONSTANT(target, GLOB_STAR);
NODE_DEFINE_CONSTANT(target, GLOB_QUOTE);
NODE_DEFINE_CONSTANT(target, GLOB_ABEND);

// the fnmatch stuff
NODE_DEFINE_CONSTANT(target, FNM_NOMATCH);
NODE_DEFINE_CONSTANT(target, FNM_NOSYS);
NODE_DEFINE_CONSTANT(target, FNM_NORES);
NODE_DEFINE_CONSTANT(target, FNM_NOESCAPE);
NODE_DEFINE_CONSTANT(target, FNM_PATHNAME);
NODE_DEFINE_CONSTANT(target, FNM_PERIOD);
NODE_DEFINE_CONSTANT(target, FNM_CASEFOLD);
NODE_DEFINE_CONSTANT(target, FNM_LEADING_DIR);

}
