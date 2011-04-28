
.SUFFIXES: .lua .js .c .out .h

ZC_SOURCES=zc.lua parse.lua codegen.lua types.lua

all:	zc

zc:	$(ZC_SOURCES)

test:	zc a.out

a.out:	a.c a.h zc.h
	gcc -g -I. a.c

a.c a.h: test.zc $(ZC_SOURCES)
	lua zc.lua -v test.zc

.js.lua:
	jslua.lua $< -o $@
