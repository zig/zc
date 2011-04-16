
class_kind.decl0_write = function(ns) {
    setoutput("header");
    outfi("typedef struct %s %s;\n", ns.name, ns.name);
}

class_kind.decl1_write_pre = function(ns) {
    setoutput("header");
    outfi("struct %s {\n", ns.name);
    outindent(1);
}

class_kind.decl1_write_post = function(ns) {
    setoutput("header");
    outindent(-1);
    outfi("}\n");
}

ctype_kind.vardecl_write = function(t, v) {
    outfi("%s %s;\n", t.target, v.name);
}

var_kind.init0 = function(v) {
    // resolve the type
    assert(v.type.kind == "typeref");
    var t = gettype(v.type.target, v.namespace);
    v.type = t;
}

var_kind.decl1_write = function(v) {
    setoutput("header");
    var t = v.type;
    t.vardecl_write(t, v);
}

namespace_kind.inner = function(ns, stage) {
    for (i, k in pairs(ns.types))
	writestage(k, stage);
    for (i, k in pairs(ns.members))
	writestage(k, stage);
}

class_kind.inner = namespace_kind.inner;


function writestage(ns, stage) {
    if (ns[stage.."_pre"])
	ns[stage.."_pre"](ns, stage);
    if (ns[stage])
	ns[stage](ns, stage);
    if (ns["inner"])
	ns["inner"](ns, stage);
    if (ns[stage.."_post"])
	ns[stage.."_post"](ns, stage);
}

function codegen() {

    for (_, stage in ipairs { "init0", "decl0_write", "decl1_write", "code0_write", "code1_write" }) {
	writestage(namespace, stage);
    }

}

;
