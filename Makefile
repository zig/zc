
.SUFFIXES: .lua .js

all:	zc.lua parse.lua

.js.lua:
	jslua.lua $< -o $@
