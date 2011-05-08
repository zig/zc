
.SUFFIXES: .lua .js .c .out .h .zc

ZC_FILES=zc.lua parse.lua codegen.lua types.lua zapi.lua

all:	zc

.PHONY:	zc
zc:	$(ZC_FILES)

%:	%.c %.h zc.h
	gcc -g -I. $< -o $@

%.c %.h: %.zc $(ZC_FILES)
	lua zc.lua -v $<

.js.lua:
	jslua.lua $< -o $@
