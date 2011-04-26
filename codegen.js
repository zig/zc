
thiz = "this";

var tmpnum = 0;
function newtmp() {
    tmpnum++;
    return string.format("__tmp%d__", tmpnum);
}

function resolve_type(v) {
    // resolve a type
    if (v.type && v.type.kind == "typeref") {
	var t = gettype(v.type.target, v.owner);
	if (!t)
	    emiterror("unknown type " .. v.type.target);
	v.type = t;
    }
}

function cnsname(ns) {
    if (!ns)
	return "?";
    if (!ns.name)
	return "";
    return cnsprefix(ns.parent)..ns.name;
}

function cnsprefix(ns) {
    if (!ns || !ns.name)
	return "";
    return cnsname(ns).."_";
}

function paramssuffix(params, is_method) {
    var res = "";
    for (i, p in ipairs(params or {})) {
	if (!is_method || i > 1)
	    res = res .. "__" .. cnsname(p.type);
    }
    return res;
}

function funcname(f) {
    var res = f.name;
    return f.name .. paramssuffix(f.params, f.is_method);
}

function cfuncname(f) {
    return cnsprefix(f.owner)..funcname(f);
}

function handle(obj, stage, newstage, ...) {
    if (obj[stage])
	return obj[stage](obj, newstage || stage, ...);
}

function handle_code(code, stage) {
    for (i, s in ipairs(code))
	handle(s, stage);
}

class_kind.init0_post = function(ns, stage) {
    for (i, f in ipairs(ns.methods)) {
	f.owner = ns;
	handle(f, stage);
	f.fullname = funcname(f);
	ns.members[f.fullname] = f;
	//print("adding", f.rettype.name, f.fullname);
    }
}
namespace_kind.init0_post = class_kind.init0_post;

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
ctype_kind.localdecl_write = function(t, v) {
    outfi("%s %s = 0;\n", t.target, v.name);
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
class_kind.localdecl_write = function(t, v) {
    outfi("%s *%s = NULL;\n", cnsname(t), v.name);
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

intrinsicfunc_kind.init0 = function(f, stage) {
    if (f.owner.kind == "class" && !f.mods.static) {
	f.is_method = 1;
	var param = {
	    name = thiz,
	    type = f.owner,
	    param_index = 1,
	}
	setkind(param, var_kind);
	print(f.name);
	setmember(param, f);
	table.insert(f.params, 1, param);
    }
    for (i, k in pairs(f.members))
	resolve_type(k);
    f.rettype = gettype(f.rettype.target, f.owner);
}
func_kind.init0 = function(f, stage) {
    intrinsicfunc_kind.init0(f, stage);
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
    setoutput("code");
    funcdecl(f);
    out("\n\t{\n");
    outindent(1);
    pushnamespace(f);
    for (i, v in pairs(f.members))
	if (!v.param_index)
	    v.type.localdecl_write(v.type, v);
    handle_code(f.code, stage);
    popnamespace(f);
    outindent(-1);
    outfi("}\n");
}


number_kind.right_code0_write = function(o, stage) {
    if (string.find(o.target, '[.]'))
	o.type = gettype("float", globalns);
    else
	o.type = gettype("int", globalns);
    return o.target;
}

call_kind.right_code0_write = function(o, stage) {
    var params = "";
    for (i, p in ipairs(o)) {
	params = params..handle(p, "right_"..stage, stage);
	if (i < #o)
	    params = params..", ";
    }

    var thiz = handle(o.func, "right_"..stage, stage, nil, o);
    var f = o.func.member;

    o.type = o.func.type;

    if (f.is_method) {
	if (#o > 0)
	    thiz = thiz..", ";
	params = thiz..params;
    }
    return cfuncname(o.func.member).."("..params..")";
}

dot_kind.right_code0_write = function(o, stage, owner, signature) {
    var o1, o2;

    o1 = handle(o[1], "right_"..stage, stage, owner);
    o2 = handle(o[2], "right_"..stage, stage, o[1].type, signature);

    if (o[2].kind != "dot" && o[2].kind != "memberref")
	emiterror("syntax error");

    o.type = o[2].type;
    o.member = o[2].member;

    if (o.member.rettype)
	return o1;
    else
	return string.format("%s -> %s ", o1, o2);
}

op_kind.right_code0_write = function(o, stage) {
    var o1, o2 = handle(o[1], "right_"..stage, stage), handle(o[2], "right_"..stage, stage);
    var m = getmember("operator_"..o.op.name..paramssuffix(o));
    if (!m) {
	emiterror("no corresponding operator "..o.op.name..paramssuffix(o));
	return "";
    }
    o.type = m.rettype;
    if (m.intrinsic)
	return string.format("( %s %s %s )", o1, o.op.cop, o2);
    else
	return string.format("%s( %s, %s )", cfuncname(m), o1, o2);
}

memberref_kind.right_code0_write = function(o, stage, explicitowner, signature) { 
    var lookup = o.target..paramssuffix(signature);
    var res = "";
    var ns = explicitowner;
    if (!explicitowner) {
	ns = o.owner;
	while (!ns.members[lookup] && ns.owner) {
	    ns = ns.owner;
	    if (res != "")
		res = "->"..res;
	    res = thiz..res;
	}
    }
    var v = ns.members[lookup];
    o.member = v;
    if (v) {
	if (ns.kind == "namespace")
	    res = "";
	if (v.rettype) {
	    o.type = v.rettype;
	} else {
	    o.type = v.type;
	    if (res != "")
		res = res.."->";
	    res = res..o.target;
	}
    } else if (explicitowner)
	emiterror("unknown member "..o.target);
    else
	emiterror("unknown identifier "..o.target);
    return res;
}

nil_kind.right_code0_write = function(o) {
    return "";
}
 
return_kind.code0_write = function(o, stage) {
    outfi("return %s;\n", handle(o[1], "right_"..stage, stage));
}

expr_kind.code0_write = function(o, stage) {
    outfi("%s;\n", handle(o[1], "right_"..stage, stage));
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

    setoutput("header");
    out('#include <zc.h>\n\n');
    setoutput("code");
    out('#include "a.h"\n\n');

    for (_, stage in ipairs { 
	"init0", 
	"decl0_write", 
	"decl1_write", 
	"decl2_write", 
	"code0_write", 
	"code1_write" }) {
	writestage(namespace, stage);
    }

    //dump(namespace);
}

;
