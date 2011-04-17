
function resolve_type(v) {
    // resolve a type
    if (v.type && v.type.kind == "typeref")
	v.type = gettype(v.type.target, v.owner);
}

function cnsname(ns) {
    if (!ns.name)
	return "";
    return cnsprefix(ns.parent)..ns.name;
}

function cnsprefix(ns) {
    if (!ns.name)
	return "";
    return cnsname(ns).."_";
}

function cfuncname(f) {
    return cnsprefix(f.owner)..f.name;
}

class_kind.decl0_write = function(ns) {
    setoutput("header");
    outfi("typedef struct %s %s;\n", cnsname(ns), cnsname(ns));
}

class_kind.decl1_write_pre = function(ns) {
    setoutput("header");
    outfi("struct %s {\n", cnsname(ns));
    outindent(1);
}

class_kind.decl1_write_post = function(ns) {
    setoutput("header");
    outindent(-1);
    outfi("};\n");
}

namespace_kind.pre = function(ns, stage) {
    for (i, k in pairs(ns.types))
	writestage(k, stage);
}

namespace_kind.inner = function(ns, stage) {
    for (i, k in pairs(ns.members))
	writestage(k, stage);
}

class_kind.pre = namespace_kind.pre;
class_kind.inner = namespace_kind.inner;

ctype_kind.vardecl_write = function(t, v) {
    outfi("%s %s;\n", t.target, v.name);
}

ctype_kind.paramdecl_write = function(t, v) {
    outfi("%s %s", t.target, v.name);
}

ctype_kind.funcret_write = function(t, f, name) {
    outfi("%s %s", t.target, name);
}

class_kind.vardecl_write = function(t, v) {
    outfi("%s *%s;\n", cnsname(t), v.name);
}

class_kind.paramdecl_write = function(t, v) {
    outfi("%s *%s", t.target, v.name);
}

class_kind.funcret_write = function(t, f, name) {
    outfi("%s *%s", t.target, name);
}

var_kind.init0 = resolve_type;

var_kind.decl1_write = function(v) {
    setoutput("header");
    var t = v.type;
    if (!v.param_index && t.vardecl_write)
	t.vardecl_write(t, v);
}

func_kind.init0 = function(f, stage) {
    for (i, k in pairs(f.members))
	resolve_type(k);
    f.rettype = gettype(f.rettype.target, f.owner);
}

function funcdecl(f) {
    f.rettype.funcret_write(f.rettype, f, cfuncname(f));
    outf("(\n");
    outindent(1);
    for (i, v in ipairs(f.params)) {
	v.type.paramdecl_write(v.type, v);
	if (i < #f.params)
	    out(",\n");
    }
    out("\n");
    outfi(")");
    outindent(-1);
}

func_kind.decl2_write = function(f) {
    setoutput("header");
    funcdecl(f);
    out(";\n");
}

func_kind.code0_write = function(f) {
    setoutput("source");
    funcdecl(f);
    out("\n");
    outfi("{\n");
    outindent(1);
    outindent(-1);
    outfi("}\n");
}


function writestage(ns, stage) {
    if (ns["pre"])
	ns["pre"](ns, stage);
    if (ns[stage.."_pre"])
	ns[stage.."_pre"](ns, stage);
    if (ns[stage])
	ns[stage](ns, stage);
    if (ns["inner"])
	ns["inner"](ns, stage);
    if (ns[stage.."_post"])
	ns[stage.."_post"](ns, stage);
    if (ns["post"])
	ns["post"](ns, stage);
}

function codegen() {

    for (_, stage in ipairs { "init0", "decl0_write", "decl1_write", "decl2_write", "code0_write", "code1_write" }) {
	writestage(namespace, stage);
    }

}

;
