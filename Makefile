
.SUFFIXES: .lua .js

all:	zc.lua parse.lua codegen.lua types.lua

.js.lua:
	jslua.lua $< -o $@
