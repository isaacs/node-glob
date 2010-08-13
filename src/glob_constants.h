#include <v8.h>
#include <glob.h>
#include <node.h>

using namespace node;
using namespace v8;

void
GlobConstants (Handle<Object> target) {
  // flags

// this is actually useless, because the glob_t object isn't exposed
// to the javascript layer.  Since it's so trivial to concatenate
// arrays in JS anyway, it's a bit silly to even bother with this.
// #ifdef GLOB_APPEND
//   NODE_DEFINE_CONSTANT(target, GLOB_APPEND);
// #endif

// this is useless as well, because there is no way to supply the errfunc
// function to glob().  It's just handled like the rest of node, passing
// an Error() obj to the cb.
// #ifdef GLOB_ERR
//   NODE_DEFINE_CONSTANT(target, GLOB_ERR);
// #endif

#ifdef GLOB_MARK
  NODE_DEFINE_CONSTANT(target, GLOB_MARK);
#endif
#ifdef GLOB_LIMIT
  NODE_DEFINE_CONSTANT(target, GLOB_LIMIT);
#endif
#ifdef GLOB_NOCHECK
  NODE_DEFINE_CONSTANT(target, GLOB_NOCHECK);
#endif
#ifdef GLOB_NOCASE
  NODE_DEFINE_CONSTANT(target, GLOB_NOCASE);
#endif
#ifdef GLOB_NOESCAPE
  NODE_DEFINE_CONSTANT(target, GLOB_NOESCAPE);
#endif
#ifdef GLOB_NOSORT
  NODE_DEFINE_CONSTANT(target, GLOB_NOSORT);
#endif
#ifdef GLOB_BRACE
  NODE_DEFINE_CONSTANT(target, GLOB_BRACE);
#endif
#ifdef GLOB_NOMAGIC
  NODE_DEFINE_CONSTANT(target, GLOB_NOMAGIC);
#endif
#ifdef GLOB_QUOTE
  NODE_DEFINE_CONSTANT(target, GLOB_QUOTE);
#endif
#ifdef GLOB_TILDE
  NODE_DEFINE_CONSTANT(target, GLOB_TILDE);
#endif
#ifdef GLOB_CSH
  NODE_DEFINE_CONSTANT(target, GLOB_CSH);
#endif
#ifdef GLOB_ALPHASORT
  NODE_DEFINE_CONSTANT(target, GLOB_ALPHASORT);
#endif
#ifdef GLOB_ALTDIRFUNC
  NODE_DEFINE_CONSTANT(target, GLOB_ALTDIRFUNC);
#endif
#ifdef GLOB_PERIOD
  NODE_DEFINE_CONSTANT(target, GLOB_PERIOD);
#endif
#ifdef GLOB_MAGCHAR
  NODE_DEFINE_CONSTANT(target, GLOB_MAGCHAR);
#endif
#ifdef GLOB_TILDE_CHECK
  NODE_DEFINE_CONSTANT(target, GLOB_TILDE_CHECK);
#endif
#ifdef GLOB_ONLYDIR
  NODE_DEFINE_CONSTANT(target, GLOB_ONLYDIR);
#endif

  // errors
#ifdef GLOB_ABORTED
  NODE_DEFINE_CONSTANT(target, GLOB_ABORTED);
#endif
#ifdef GLOB_ABEND
  NODE_DEFINE_CONSTANT(target, GLOB_ABEND);
#endif
#ifdef GLOB_NOMATCH
  NODE_DEFINE_CONSTANT(target, GLOB_NOMATCH);
#endif
#ifdef GLOB_NOSPACE
  NODE_DEFINE_CONSTANT(target, GLOB_NOSPACE);
#endif
}

