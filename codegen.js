
thiz = "__thiz__";

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

function handle(obj, stage, newstage) {
    if (obj[stage])
	return obj[stage](obj, newstage || stage);
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
    outfi("%s *%s", cnsname(t), v.name);
}

class_kind.funcret_write = function(t, f, name) {
    outfi("%s *%s", cnsname(t), name);
}

var_kind.init0 = resolve_type;

var_kind.decl1_write = function(v) {
    setoutput("header");
    var t = v.type;
    if (!v.param_index && t.vardecl_write)
	t.vardecl_write(t, v);
}

function handle_code(code, stage) {
    for (i, s in ipairs(code))
	if (s[stage])
	    s[stage](s, stage);
}

func_kind.init0 = function(f, stage) {
    if (f.owner.kind == 'class') {
	var param = {
	    name = thiz,
	    type = f.owner,
	    param_index = 1,
	}
	setkind(param, var_kind);
	setmember(param, f);
	table.insert(f.params, 1, param);
    }
    for (i, k in pairs(f.members))
	resolve_type(k);
    f.rettype = gettype(f.rettype.target, f.owner);
    handle_code(f.code, stage);
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

func_kind.decl2_write = function(f, stage) {
    setoutput("header");
    funcdecl(f);
    out(";\n");
    handle_code(f.code, stage);
}

func_kind.code0_write = function(f, stage) {
    setoutput("source");
    funcdecl(f);
    out("\n\t{\n");
    outindent(1);
    handle_code(f.code, stage);
    outindent(-1);
    outfi("}\n");
}


op_kind.right_code0_write = function(o, stage) {
    out("( ");
    handle(o[1], "right_"..stage, stage);
    out(" ".. o.op.name .." ");
    handle(o[2], "right_"..stage, stage);
    out(" )");
}

memberref_kind.right_code0_write = function(o, stage) {
    out(o.target);
}

return_kind.code0_write = function(o, stage) {
    outfi("return ");
    handle(o[1], "right_"..stage, stage);
    out(";\n");
}

expr_kind.code0_write = function(o, stage) {
    outi();
    handle(o[1], "right_"..stage, stage);
    out(";\n");
}


function writestage(ns, stage) {
    for (i, s in ipairs({
	"pre",
	stage.."_pre",
	stage,
	"inner",
	stage.."_post",
	"post",
    }))
	handle(ns, s, stage);
}

function codegen() {

    for (_, stage in ipairs { "init0", "decl0_write", "decl1_write", "decl2_write", "code0_write", "code1_write" }) {
	writestage(namespace, stage);
    }

}

;
