
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
    if (!f)
	return "?";
    var res = f.name;
    return f.name .. paramssuffix(f.params, f.is_method);
}

function cfuncname(f) {
    if (!f)
	return "?";
    return cnsprefix(f.owner)..funcname(f);
}

function handle(obj, stage, newstage, ...) {
    var pos = savepos();
    var res;
    if (obj.source)
	gotopos(obj.source); // only so that emiterror point to correct position
    if (obj[stage])
	res = { obj[stage](obj, newstage || stage, ...) };
    gotopos(pos);
    return unpack(res or {});
}

function handle_code(code, stage) {
    var uppercode = newcode;
    newcode = { };
    var rescode = newcode;
    for (i, s in ipairs(code)) {
	var o = handle(s, stage);
	if (type(o) != "table") // temp hack
	    table.insert(newcode, s);
	else
	    table.insert(newcode, o);
    }
    newcode = oldcode;
    return rescode;
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
    outfi("zc_obj_t __zc;\n");
}

class_kind.decl1_write_post = function(ns) {
    setoutput("header");
    outindent(-1);
    outfi("};\n");
}

namespace_kind.pre = function(ns, stage) {
    for (i, k in pairs(ns.types))
	dostage(k, stage);
}

namespace_kind.inner = function(ns, stage) {
    for (i, k in pairs(ns.members))
	dostage(k, stage);
}

class_kind.pre = namespace_kind.pre;
class_kind.inner = namespace_kind.inner;

ctype_kind.vardecl_write = function(t, v) {
    outfi("%s %s;\n", t.target, v.name);
}
ctype_kind.localdecl_write = function(t, v, inival) {
    outfi("%s %s = %s;\n", t.target, v.name, inival or "0");
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
class_kind.localdecl_write = function(t, v, inival) {
    outfi("%s *%s = %s;\n", cnsname(t), v.name, inival or "NULL");
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
	    mods = {},
	}
	setkind(param, var_kind);
	//print(f.name);
	setmember(param, f);
	table.insert(f.params, 1, param);
    }
    for (i, k in pairs(f.members))
	resolve_type(k);
    f.rettype = gettype(f.rettype.target, f.owner);
}
func_kind.init0 = function(f, stage) {
    intrinsicfunc_kind.init0(f, stage);
    pushnamespace(f);
    handle_code(f.code, stage);
    popnamespace(f);
}
func_kind.ana0 = function(f, stage) {
    pushnamespace(f);
    f.code = handle_code(f.code, stage);
    popnamespace(f);
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
    pushnamespace(f);
    handle_code(f.code, stage);
    popnamespace(f);
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


number_kind.ana0 = function(o, stage) {
    if (string.find(o.target, '[.]'))
	o.type = gettype("float", globalns);
    else
	o.type = gettype("int", globalns);
    return o;
}
number_kind.code0_write = function(o, stage) {
    return o.target;
}

call_kind.ana0 = function(o, stage) {
    for (i, p in ipairs(o))
	o[i] = handle(p, stage);

    var thiz = handle(o.func, stage, stage, nil, o);
    o.func = thiz.member;
    if (!o.func || o.func.kind != "func") {
	// TODO look for an 'invoke' operator
	emiterror("trying to call something that is not callable");
	return o;
    }
    thiz = thiz[1];
    o.type = o.func.rettype;
    if (o.func.is_method)
	table.insert(o, 1, thiz);
    return o;
}
call_kind.code0_write = function(o, stage) {
    var params = "";
    for (i, p in ipairs(o)) {
	params = params..handle(p, stage);
	if (i < #o)
	    params = params..", ";
    }

    return cfuncname(o.func).."("..params..")";
}

var assigners = {
    globalref = globalset_kind,
    localref = localset_kind,
};
assign_kind.ana0 = function(o, stage) {
    o[1] = handle(o[1], stage);
    o[2] = handle(o[2], stage);

    /*if (!o[1].member || o[1].member.kind != "var")
	emiterror("lvalue expected");*/

    if (o[1].type != o[2].type)
	emiterror("incompatible types in assignement");

    o.type = o[2].type;

    var r = o[1];
    if (assigners[r.kind]) {
	setkind(o, assigners[r.kind]);
	o.target = r.target;
	table.remove(o, 1);
    } else if (r.kind == "dot") {
	setkind(o, memberset_kind);
	o[1] = r[1];
	o.target = r[2].target;
    } else
	emiterror("lvalue expected");

    return o;
}

new_kind.ana0 = function(o, stage) {
    resolve_type(o);
    return o;
}
new_kind.code0_write = function(o, stage) {
    return format("calloc(sizeof(%s), 1)", cnsname(o.type));
}

dot_kind.ana0 = function(o, stage, owner, signature) {
    if (o[2].kind != "memberref")
	emiterror("syntax error");

    o[1] = handle(o[1], stage, stage, owner);
    o[2] = handle(o[2], stage, stage, o[1].type, signature);

    o.type = o[2].type;
    o.member = o[2].member;

    return o;
}
dot_kind.code0_write = function(o, stage, owner, signature) {
    return string.format("zc_getmember(%s, %s)", handle(o[1], stage), handle(o[2], stage));
}

op_kind.ana0 = function(o, stage) {
    o[1] = handle(o[1], stage);
    o[2] = handle(o[2], stage);
    var lookup = "__operator_"..o.op.name..paramssuffix(o);
    var m = getmember(lookup); /* static method */
    if ((!m || m.is_method) && o[1].type)
	/* try non static */
	m = o[1].type.members["__operator_"..o.op.name..paramssuffix({ o[2] })];
    if (!m) {
	emiterror("unknown method "..lookup);
	return o;
    }
    o.func = m;
    o.type = m.rettype;

    if (!m.intrinsic)
	/* morph to a normal call */
	setkind(o, call_kind);

    return o;
}
op_kind.code0_write = function(o, stage) {
    var o1, o2 = handle(o[1], stage), handle(o[2], stage);
    if (!o.func)
	return "";
    return string.format("( %s %s %s )", o1, o.op.cop, o2);
}

memberref_kind.ana0 = function(o, stage, explicitowner, signature) { 
    var lookup = o.target..paramssuffix(signature);
    var res = o;
    var ns = explicitowner;
    var v;
    if (!explicitowner) {
	ns = o.owner;
	v = ns.members[lookup];
	var thizchain = true;
	while (!v && ns.owner) {
	    if (!ns.members[thiz])
		thizchain = false;
	    var o2 = { target = thiz, type = ns, owner = o.owner };
	    setkind(o2, memberref_kind);
	    res = { o2, res };
	    setkind(res, dot_kind);
	    ns = ns.owner;
	    v = ns.members[lookup];
	    if (v) {
		if (ns.kind == "namespace" || v.mods.static) {
		    res = o;
		    res.type = v.type;
		    res.member = v;
		    res.owner = ns;
		} if (!thizchain)
		    v = nil;
	    }
	}
	return handle(res, stage, stage, o.owner, signature);
    }
    v = ns.members[lookup];
    if (v) {
	if (ns.kind == "namespace" || v.mods.static) {
	    res = o;
	    setkind(o, globalref_kind);
	} else if (explicitowner == o.owner)
	    setkind(o, localref_kind);
	res.member = v;
	res.type = v.type;
    } else if (ns.kind == "class")
	emiterror("unknown member "..o.target);
    else
	emiterror("unknown identifier "..o.target);
    return res;
}
memberref_kind.code0_write = function(o, stage, explicitowner, signature) { 
    return o.target;
}
memberset_kind.code0_write = function(o, stage) {
    return format("zc_setmember(%s, %s, %s)", handle(o[1], stage), o.target, handle(o[2], stage));
}
globalref_kind.code0_write = function(o, stage, explicitowner, signature) { 
    return string.format("zc_getglobal(%s)", o.target);
}
globalset_kind.code0_write = function(o, stage) {
    return format("zc_setglobal(%s, %s)", o.target, handle(o[1], stage));
}
localref_kind.code0_write = function(o, stage, explicitowner, signature) { 
    return string.format("zc_getlocal(%s)", o.target);
}
localset_kind.code0_write = function(o, stage) {
    return format("zc_setlocal(%s, %s)", o.target, handle(o[1], stage));
}

nil_kind.code0_write = function(o) {
    return "";
}
 
return_kind.ana0 = function(o, stage) {
    o[1] = handle(o[1], stage);
    //o[1] = make_ref(o[1]);
    if (o[1].type != o.owner.rettype)
	emiterror("incompatible returned type");
    return o;
}
return_kind.code0_write = function(o, stage) {
    outfi("return %s;\n", handle(o[1], stage));
}

expr_kind.ana0 = function(o, stage) {
    o[1] = handle(o[1], stage);
    return o;
}
expr_kind.code0_write = function(o, stage) {
    outfi("%s;\n", handle(o[1], stage));
}


function dostage(ns, stage) {
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
	"ana0", 
	"decl0_write", 
	"decl1_write", 
	"decl2_write", 
	"code0_write", 
	"code1_write" }) {
	dostage(namespace, stage);
    }

    //dump(namespace);
}

;
