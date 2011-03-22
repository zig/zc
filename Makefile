
.SUFFIXES: .lua .js

all:	zc.lua parse.lua codegen.lua

.js.lua:
	jslua.lua $< -o $@
