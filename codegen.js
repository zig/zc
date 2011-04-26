
thiz = "__thiz__";

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

function paramssuffix(params) {
    var res = "";
    for (i, p in ipairs(params)) {
	res = res .. "__" .. cnsname(p.type);
    }
    return res;
}

function funcname(f) {
    var res = f.name;
    return f.name .. paramssuffix(f.params);
}

function cfuncname(f) {
    return cnsprefix(f.owner)..funcname(f);
}

function handle(obj, stage, newstage) {
    if (obj[stage])
	return obj[stage](obj, newstage || stage);
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
ctype_kind.localdecl_write = ctype_kind.vardecl_write;

ctype_kind.paramdecl_write = function(t, v) {
    outfi("%s %s", t.target, v.name);
}

ctype_kind.funcret_write = function(t, f, name) {
    outfi("%s %s", t.target, name);
}

class_kind.vardecl_write = function(t, v) {
    outfi("%s *%s;\n", cnsname(t), v.name);
}
class_kind.localdecl_write = class_kind.vardecl_write;

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


dot_right_code0_write = function(o, stage, owner) {
    //print(o.kind, o.target or o.op.cop, owner);
    if (o.kind == "memberref") {
	if (owner) {
	    var v = owner.members && owner.members[o.target];
	    if (!v) {
		emiterror("unknown member "..o.target);
		return "?";
	    }
	    o.type = v.type;
	    return o.target;
	} else
	    return handle(o, stage);
    }
    if (o.kind != "op" || o.op.name != "dot") {
	emiterror("syntax error");
	return "";
    }
    
    var o1, o2;

    if (!owner)
	o1 = handle(o[1], "right_"..stage, stage);
    else
	o1 = dot_right_code0_write(o[1], stage, owner);
    owner = o[1].type;
    o2 = dot_right_code0_write(o[2], stage, owner);

    o.type = o[2].type;

    return string.format("%s -> %s ", o1, o2);
}

op_kind.right_code0_write = function(o, stage) {
    if (o.op.name == "dot")
	return dot_right_code0_write(o, stage);
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
/*    var tmp = newtmp();
    if (o.type)
	o.type.localdecl_write(o.type, { name = tmp });
    outf("\t%s = operator_%s%s( %s, %s );\n", tmp, o.op.name, paramssuffix(o), o1, o2);
    return tmp;*/
}

memberref_kind.right_code0_write = function(o, stage) {
    var res = o.target;
    var ns = o.owner;
    while (!ns.members[o.target] && ns.owner) {
	ns = ns.owner;
	res = thiz.."->"..res;
    }
    if (ns.members[o.target])
	o.type = ns.members[o.target].type;
    else
	emiterror("unknown identifier "..o.target);
    if (ns.kind == "namespace")
	res = o.target;
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

}

;
