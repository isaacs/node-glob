#!/usr/bin/env python
srcdir = "."
blddir = "build"
VERSION = "0.0.1"

def set_options(opt):
  opt.tool_options("compiler_cxx")

def configure(conf):
  conf.check_tool("compiler_cxx")
  conf.check_tool("node_addon")

def build(bld):
  ### bsd_glob
  bsd_glob = bld.new_task_gen("cxx")
  bsd_glob.source = "deps/glob/glob.c"
  bsd_glob.includes = "deps/glob/"
  bsd_glob.name = "bsd_glob"
  bsd_glob.target = "bsd_glob"
  bsd_glob.install_path = None
  bsd_glob.cxxflags = ["-fPIC"]

  ### bsd_fnmatch
  bsd_fnmatch = bld.new_task_gen("cxx")
  bsd_fnmatch.source = "deps/fnmatch/fnmatch.c"
  bsd_fnmatch.includes = "deps/fnmatch/"
  bsd_fnmatch.name = "bsd_fnmatch"
  bsd_fnmatch.target = "bsd_fnmatch"
  bsd_fnmatch.install_path = None
  bsd_fnmatch.cxxflags = ["-fPIC"]

  obj = bld.new_task_gen("cxx", "shlib", "node_addon")
  obj.add_objects = "bsd_glob bsd_fnmatch"
  obj.includes = """
    src/
    deps/glob/
    deps/fnmatch/
  """
  obj.cxxflags = ["-D_FILE_OFFSET_BITS=64", "-D_LARGEFILE_SOURCE"]
  obj.target = "glob"
  obj.source = "src/glob.cc"

  ### debug versions
  bsd_glob_debug = bld.new_task_gen("cxx")
  bsd_glob_debug.source = bsd_glob.source
  bsd_glob_debug.includes = bsd_glob.includes
  bsd_glob_debug.name = "bsd_glob_debug"
  bsd_glob_debug.target = "bsd_glob_debug"
  bsd_glob_debug.install_path = None
  bsd_glob_debug.cxxflags = ["-fPIC", "-DDEBUG"]

  bsd_fnmatch_debug = bld.new_task_gen("cxx")
  bsd_fnmatch_debug.source = bsd_fnmatch.source
  bsd_fnmatch_debug.includes = bsd_fnmatch.includes
  bsd_fnmatch_debug.name = "bsd_fnmatch_debug"
  bsd_fnmatch_debug.target = "bsd_fnmatch_debug"
  bsd_fnmatch_debug.install_path = None
  bsd_fnmatch_debug.cxxflags = ["-fPIC", "-DDEBUG"]

  obj_debug = bld.new_task_gen("cxx", "shlib", "node_addon")
  obj_debug.add_objects = "bsd_glob_debug bsd_fnmatch_debug"
  obj_debug.includes = obj.includes
  obj_debug.cxxflags = ["-D_FILE_OFFSET_BITS=64", "-D_LARGEFILE_SOURCE", "-DDEBUG"]
  obj_debug.target = "glob_g"
  obj_debug.source = obj.source
