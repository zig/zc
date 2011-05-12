
thiz = "this";

var tmpnum = 0;
function newtmpname() {
    tmpnum++;
    return string.format("__tmp%d__", tmpnum);
}

function newtmp(expr) {
    if (!expr.type)
	return expr;

    if (expr.type == gettype("void", globalns)) {
	addexpr(expr);
	var v = {
	    type = gettype("void", globalns);
	};
	return v;
    }

    var name = newtmpname();

    var v = {
	name = name,
	type = expr.type,
	tmpvar = 1,
	member = expr.member,
    };
    setkind(v, var_kind);
    setmember(v, expr.owner);

    var def = {
	expr,
	target = name,
	member = v,
	type = v.type,
    };
    setkind(def, localset_kind);
    addexpr(def);

    var get = {
	target = name,
	member = v,
	type = v.type,
	referenced = expr.referenced,
    };
    setkind(get, localget_kind);

    return get;
}
function cptmp(tmp) {
    var get = {
	target = tmp.target,
	member = tmp.member,
	type = tmp.type,
	referenced = tmp.referenced,
    };
    setkind(get, localget_kind);

    return get;
}

function needref(expr) {
    var type = expr.type;
    return type && type.kind == "class" && !expr.referenced;
}
function needunref(expr) {
    var type = expr.type;
    return type && type.kind == "class" && expr.referenced;
}
function ref(expr) {
    if (!expr || !needref(expr))
	return expr;
    var ref = {
	expr,
	type = expr.type,
	member = expr.member,
	referenced = 1,
    }
    setkind(ref, ref_kind);
    return ref;
}
function unref(expr) {
    if (!expr || !needunref(expr))
	return expr;
    var unref = {
	expr,
	type = expr.type,
	member = expr.member,
    }
    setkind(unref, unref_kind);
    return unref;
}
function addexpr(expr) {
    var expr = {
	expr,
	/*info = debug.getinfo(2),
	info2 = debug.getinfo(3),*/
    }
    setkind(expr, expr_kind);
    table.insert(newcode, expr);
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
    return cnsprefix(ns.owner)..ns.name;
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
	gotopos(obj.source); // so that emiterror point to correct position
    if (obj[stage]) {
	res = { obj[stage](obj, newstage || stage, ...) };
	if (obj.default_handlers && #res == 0)
	    res = { obj };
    } else if (obj.default_handlers) {
	for (i, v in ipairs(obj)) {
	    if (v.default_handlers)
		obj[i] = handle(v, stage);
	}
	res = { obj };
    }
    //gotopos(pos);
    return unpack(res or {});
}

function handle_code(code, stage, pos) {
    if (!code)
	return;
    var uppercode = newcode;
    newcode = { };
    var rescode = newcode;
    for (i, s in ipairs(code)) {
	if (false && pos && s.source) {
	    out("\t/* ");
	    while (s.source && pos < s.source.pos) {
		outf("%s ", s.source.source.tokens[pos - 1]);
		pos++;
	    }
	    out("*/\n");
	}
	var o = handle(s, stage);
	table.insert(newcode, o);
    }
    newcode = oldcode;
    return rescode;
}

// can we cast expr into type ?
function cancast(expr, type) {
    if (!expr.type || !type)
	return false;
    if (expr.type == type)
	return true;
    var f = type.members["__init"..paramssuffix({ { type = expr.type } })];
    return f && f.kind == "func";
}

// make sure you check it's castable before
function cast(expr, type) {
    if (expr.type == type)
	return expr;
    var f = type.members["__init"..paramssuffix({ { type = expr.type } })];
    var casted = {
	expr,
	func = f,
	type = type,
    };
    setkind(casted, call_kind);

    if (type.kind == "class") {
	var thiz = {
	    type = type,
	};
	setkind(thiz, new_kind);
	thiz = newtmp(thiz);
	table.insert(casted, thiz);
	thiz.referenced = true;
    }

    return casted;
}

class_kind.init0_post = function(ns, stage) {
    for (i, f in ipairs(ns.methods)) {
	f.owner = ns;
	handle(f, stage);
	f.fullname = funcname(f);
	ns.members[f.fullname] = f;
	table.insert(ns.declarations, f);
    }
    ns.methods = {};

    if (ns.kind == "class") {
	newop("equal", "boolean", ns, ns);
	newop("different", "boolean", ns, ns);
	newop("equal", "boolean", ns, "null");
	newop("different", "boolean", ns, "null");
	newop("equal", "boolean", "null", ns);
	newop("different", "boolean", "null", ns);
	newcaster("boolean", ns).intrinsic.call_write = function(o, stage) {
	    return format("(%s != NULL)", handle(o[1], stage));
	};
	for (i, f in ipairs(ns.methods)) {
	    f.owner = ns;
	    handle(f, stage);
	    f.fullname = funcname(f);
	    if (!ns.members[f.fullname])
		ns.members[f.fullname] = f;
	}
	ns.methods = {};
    }
}
namespace_kind.init0_post = class_kind.init0_post;
ctype_kind.init0_post = class_kind.init0_post;
boolean_kind.init0_post = class_kind.init0_post;
null_kind.init0_post = class_kind.init0_post;

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

class_kind.code0_write = function(ns) {
    setoutput("code");
    outfi("%s__destructor(%s *this) {\n", cnsname(ns), cnsname(ns));
    outindent(1);
    for (i, v in pairs(ns.members))
	if (v.type && v.type.member_destructor_write)
	    v.type.member_destructor_write(v.type, v);
    outindent(-1);
    outfi("};\n");
}

namespace_kind.pre = function(ns, stage) {
    if (stage != "zapi_write")
	for (i, k in pairs(ns.types))
	    dostage(k, stage);
}

namespace_kind.inner = function(ns, stage) {
    if (stage == "zapi_write")
	for (i, k in pairs(ns.types))
	    dostage(k, stage);
    for (i, k in pairs(ns.declarations))
	dostage(k, stage);
}

class_kind.pre = namespace_kind.pre;
class_kind.inner = namespace_kind.inner;

null_kind.vardecl_write = function(t, v) {
    outfi("void *%s;\n", v.name);
}
null_kind.localdecl_write = function(t, v) {
    outfi("void *%s = NULL;\n", v.name);
}
null_kind.paramdecl_write = function(t, v) {
    outfi("void *%s", v.name);
}
null_kind.funcret_write = function(t, f, name) {
    outfi("void *%s", name);
}

boolean_kind.vardecl_write = function(t, v) {
    outfi("int %s;\n", v.name);
}
boolean_kind.localdecl_write = function(t, v) {
    outfi("int %s = 0;\n", v.name);
}
boolean_kind.paramdecl_write = function(t, v) {
    outfi("int %s", v.name);
}
boolean_kind.funcret_write = function(t, f, name) {
    outfi("int %s", name);
}

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
class_kind.local_destructor_write = function(t, v) {
    outfi("zc_objunref(%s, %s);\n", cnsname(t), v.name);
}
class_kind.member_destructor_write = function(t, v) {
    outfi("zc_objunref(%s, this->%s);\n", cnsname(t), v.name);
}

var_kind.init0 = resolve_type;

var_kind.decl1_write = function(v) {
    setoutput("header");
    var t = v.type;
    if (!v.param_index && t.vardecl_write)
	t.vardecl_write(t, v);
}

raw_kind.decl1_write = function(v) {
    setoutput("header");
    var pos = v.start.pos;
    var source = v.start.source;
    var line = source.tokenlines[pos];
    outfi("");
    while (pos < v.stop.pos - 1) {
	if (line != source.tokenlines[pos]) {
	    line = source.tokenlines[pos];
	    out("\n\t");
	}
	outf("%s ", source.tokens[pos]);
	pos++;
    }
    out("\n");
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
    f.code = handle_code(f.code, stage);
    popnamespace(f);
}
func_kind.ana0 = function(f, stage) {
    pushnamespace(f);
    f.code = handle_code(f.code, stage);
    popnamespace(f);
}
func_kind.ana1 = function(f, stage) {
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
    if (!f.code)
	return;
    setoutput("code");
    funcdecl(f);
    out("\n\t{\n");
    outindent(1);
    pushnamespace(f);
    if (f.rettype != gettype("void", globalns))
	f.rettype.localdecl_write(f.rettype, { name = "__result" });
    for (i, v in pairs(f.members)) {
	if (!v.param_index)
	    v.type.localdecl_write(v.type, v);
	else if (v.type.kind == "class")
	    outfi("zc_objref(%s, %s);\n", cnsname(v.type), v.name);
    }
    handle_code(f.code, stage, f.source.pos);
    outfi("__destructors:;\n");
    for (i, v in pairs(f.members))
	if (!v.tmpvar && v.type && v.type.local_destructor_write)
	    v.type.local_destructor_write(v.type, v);
    if (f.rettype != gettype("void", globalns))
	outfi("return __result;\n");
    popnamespace(f);
    outindent(-1);
    outfi("}\n");
}


number_kind.ana0 = function(o, stage) {
    if (!string.find(o.target, "'") && string.find(o.target, '[.]'))
	o.type = gettype("float", globalns);
    else
	o.type = gettype("int", globalns);
    return o;
}
number_kind.code0_write = function(o, stage) {
    return o.target;
}

constant_kind.ana0 = function(o, stage) {
    resolve_type(o);
    return o;
}
constant_kind.code0_write = function(o, stage) {
    return o.target;
}

call_kind.ana0 = function(o, stage) {
    var constructor;

    for (i, p in ipairs(o))
	o[i] = handle(p, stage);

    var thiz = handle(o.func, stage, stage, nil, o, true);

    if (thiz.kind == "type") {
	// cast / constructor
	var type = thiz.type;
	var lookup = "__init"..paramssuffix(o);
	o.func = type.members[lookup];
	if (o.func && o.func.kind == "intrinsicfunc") {
	    
	} else if (thiz.type.kind == "class") {
	    thiz = {
		type = type,
	    };
	    setkind(thiz, new_kind);
	    if (#o == 0 && !o.func) {
		thiz.referenced = true;
		return thiz;
	    }
	    thiz = newtmp(thiz);
	    constructor = cptmp(thiz);
	    constructor.referenced = true;
	}
    } else {
	o.func = thiz.member;
	thiz = thiz[1];
    }
    if (!o.func || o.func.kind != "func") {
	// TODO look for an 'invoke' operator
	emiterror("trying to call something that is not callable");
	return o;
    }
    o.type = o.func.rettype;
    if (o.func.is_method) {
	if (!thiz || !thiz.type || thiz.type.kind != "class")
	    emiterror("trying to call non static method without an object");
	else
	    table.insert(o, 1, thiz);
    }
    o.referenced = true;

    if (constructor) {
	addexpr(o);
	return constructor;
    } else
	return o;
}
call_kind.ana1 = function(o, stage) {
    var unrefs = { };
    for (i, p in ipairs(o)) {
	p = handle(p, stage);
	o[i] = p;
	if (needunref(p)) {
	    p = newtmp(p);
	    table.insert(unrefs, p);
	    o[i] = p;
	}
    }
    if (#unrefs > 0) {
	o = newtmp(o);
	for (_, p in ipairs(unrefs))
	    addexpr(unref(p));
    }

    return o;
}
call_kind.code0_write = function(o, stage) {
    var params = "";
    for (i, p in ipairs(o)) {
	params = params..handle(p, stage);
	if (i < #o)
	    params = params..", ";
    }

    if (!o.func.intrinsic)
	return cfuncname(o.func).."("..params..")";
    else if (o.func.intrinsic.call_write)
	return o.func.intrinsic.call_write(o, stage);
    else if (o.op) {
	if (#o == 1)
	    return string.format("( %s %s )", o.op.cop, handle(o[1], stage));
	else // 2
	    return string.format("( %s %s %s )", handle(o[1], stage), o.op.cop, handle(o[2], stage));
    } else
	return "("..params..")";
}

get2set_table = {
    memberget = memberset_kind,
    globalget = globalset_kind,
    localget = localset_kind,
};

function get2set(r, expr) {
    if (get2set_table[r.kind]) {
	setkind(r, get2set_table[r.kind]);
	table.insert(r, expr);
	return r;
    }
}

set2get_table = {
    memberset = memberget_kind,
    globalset = globalget_kind,
    localset = localget_kind,
};
function set2get(r) {
    if (get2set_table[r.kind]) {
	setkind(r, get2set_table[r.kind]);
	var expr = table.remove(r);
	return r, expr;
    }
}

assign_kind.ana0 = function(o, stage) {
    o[1] = handle(o[1], stage);
    o[2] = handle(o[2], stage);

    /*if (!o[1].member || o[1].member.kind != "var")
	emiterror("lvalue expected");*/

    if (o[1].type != o[2].type && 
	(!o[1].type || o[1].type.kind != "class" || o[2].type != gettype("null", globalns)))
	emiterror("incompatible types in assignement");

    o.type = o[1].type;

    var r = get2set(o[1], o[2]);
    if (r)
	return handle(r, stage);
    else {
	emiterror("lvalue expected");
	return o;
    }
}

new_kind.ana0 = function(o, stage) {
    resolve_type(o);
    o.referenced = true;
    return o;
}
new_kind.code0_write = function(o, stage) {
    return format("zc_objnew(%s)", cnsname(o.type));
}

dot_kind.ana0 = function(o, stage, owner, signature, accepttype) {
    if (o[2].kind != "memberref") {
	emiterror("syntax error");
	return o;
    }

    o[1] = handle(o[1], stage, stage, owner, nil, true);
    o[2] = handle(o[2], stage, stage, o[1].type, signature, accepttype);

    if (o[1].kind == "type") {
	if (o[2].kind == "type")
	    return o[2];
	if (!o[2].member || !o[2].member.mods.static)
	    emiterror("trying to statically access non static member");
    }

    o.type = o[2].type;
    o.member = o[2].member;

    o.target = o[2].target;
    table.remove(o, 2);
    setkind(o, memberget_kind);

    return handle(o, stage);
}
dot_kind.code0_write = function(o, stage) {
    return "";
}

op_kind.ana0 = function(o, stage) {
    for (i, p in ipairs(o))
	o[i] = handle(p, stage);

    var lookup = "__operator_"..o.op.name..paramssuffix(o);
    var m = getmember(lookup); /* static method */
    if ((!m || m.is_method) && o[1].type)
	/* try non static */
	m = o[1].type.members["__operator_"..o.op.name..paramssuffix({ o[2] })];

    if (!m) {
	// retry with casting
	if (o.op.boolean)
	    for (i, p in ipairs(o))
		if (cancast(p, gettype("boolean", globalns)))
		    o[i] = cast(p, gettype("boolean", globalns));
	
	/*if (o.op.comparison && o[1].type != o[2].type) {
	    if (cancast(o[2], o[1].type))
		o[2] = cast(o[2], o[1].type);
	    else if (cancast(o[1], o[2].type))
		o[1] = cast(o[1], o[2].type);
	}*/
	lookup = "__operator_"..o.op.name..paramssuffix(o);
	m = getmember(lookup); /* static method */
	if ((!m || m.is_method) && o[1].type)
	    /* try non static */
	    m = o[1].type.members["__operator_"..o.op.name..paramssuffix({ o[2] })];
    }

    if (!m) {
	emiterror("unknown method "..lookup);
	return o;
    }
    o.func = m;
    o.type = m.rettype;

    /* morph to a normal call */
    setkind(o, call_kind);
    o.referenced = true;

    return o;
}

memberref_kind.ana0 = function(o, stage, explicitowner, signature, accepttype) { 
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
	    if (thizchain) {
		var o2 = { target = thiz, type = ns, owner = o.owner };
		setkind(o2, memberref_kind);
		res = { o2, res };
		setkind(res, dot_kind);
	    }
	    ns = ns.owner;
	    v = ns.members[lookup] || (accepttype && ns.types[o.target]);
	    if (v) {
		if (ns.kind == "namespace" || v.mods.static) {
		    res = o;
		    res.owner = ns;
		} else if (!thizchain)
		    v = nil;
	    }
	}

	return handle(res, stage, stage, res.owner, signature, accepttype);
    }
    v = ns.members[lookup];
    if (v) {
	if (ns.kind == "namespace" || v.mods.static)
	    setkind(o, globalget_kind);
	else if (explicitowner == o.owner)
	    setkind(o, localget_kind);
	res.member = v;
	res.type = v.type;
    } else {
	v = accepttype && ns.types[o.target];
	if (v) {
	    res = {
		type = v,
	    };
	    setkind(res, type_kind);
	} else if (ns.kind == "class")
	    emiterror("unknown member "..o.target);
	else
	    emiterror("unknown identifier "..o.target);
    }
    return res;
}

ref_kind.code0_write = function(o, stage) {
    return format("zc_objref(%s, %s)", cnsname(o.type), handle(o[1], stage));
}
unref_kind.code0_write = function(o, stage) {
    return format("zc_objunref(%s, %s)", cnsname(o.type), handle(o[1], stage));
}

memberget_kind.ana0 = function(o, stage) {
    // the default handler would reapply handle on o[1], 
    // which was already done in the dot_kind handler !
    return o;
}
memberget_kind.ana1 = function(o, stage) {
    o[1] = handle(o[1], stage);
    if (!needunref(o[1]))
	return o;
    o[1] = newtmp(o[1]);
    var t = newtmp(o);
    addexpr(unref(o[1]));
    return t;
}
memberget_kind.code0_write = function(o, stage) { 
    return string.format("(%s)->%s", handle(o[1], stage), o.target);
}
memberset_kind.ana0 = function(o, stage) {
    if (o.type.kind != "class")
	return o;
    o[1] = newtmp(o[1]);
    o[2] = newtmp(ref(o[2]));
    var get = {
	o[1],
	target = o.target,
	type = o.type,
	referenced = 1,
    };
    setkind(get, memberget_kind);
    addexpr(unref(get));
    if (needunref(o[1])) {
	var t = newtmp(o);
	addexpr(unref(o[1]));
	return t;
    } else
	return o;
}
memberset_kind.code0_write = function(o, stage) {
    return format("((%s)->%s = %s)", handle(o[1], stage), o.target, handle(o[2], stage));
}

globalget_kind.ana0 = function(o, stage) { 
    return o;
}
globalget_kind.code0_write = function(o, stage) { 
    return string.format("%s", o.target);
}
globalset_kind.ana0 = function(o, stage) {
    if (o.type.kind != "class")
	return o;
    o[1] = newtmp(ref(o[1]));
    var get = {
	target = o.target,
	type = o.type,
	referenced = 1,
    };
    setkind(get, set2get_table[o.kind]);
    addexpr(unref(get));
    return o;
}
globalset_kind.code0_write = function(o, stage) {
    return format("(%s = %s)", o.target, handle(o[1], stage));
}

localget_kind.ana0 = function(o, stage) {
    return o;
}
localget_kind.code0_write = function(o, stage) { 
    return string.format("%s", o.target);
}
localset_kind.ana0 = globalset_kind.ana0;
localset_kind.code0_write = function(o, stage) {
    return format("(%s = %s)", o.target, handle(o[1], stage));
}

nil_kind.ana0 = function(o) {
    o.type = gettype("void", globalns);
}
nil_kind.code0_write = function(o) {
    return "";
}
 
return_kind.ana0 = function(o, stage) {
    o[1] = ref(handle(o[1], stage));
    /*if (o[1].type != o.owner.rettype) {
	if (cancast(o[1], o.owner.rettype))
	    o[1] = cast(o[1], o.owner.rettype);
    }*/
    if (o[1].type != o.owner.rettype)
	emiterror("incompatible returned type");
    return o;
}
return_kind.code0_write = function(o, stage) {
    if (!o[1] || o[1].type == gettype("void", globalns))
	outfi("goto __destructors;\n");
    else
	outfi("__result = %s; goto __destructors;\n", handle(o[1], stage));
}

expr_kind.ana0 = function(o, stage) {
    o[1] = unref(handle(o[1], stage));
    return o;
}
expr_kind.ana1 = expr_kind.ana0;
expr_kind.code0_write = function(o, stage) {
    var expr = o[1];

    // dead code elimination
    // to be moved into the analysis phase
    while (get2set_table[expr.kind]) {
	if (expr[1])
	    expr = expr[1];
	else
	    return;
    }

    var s = expr && handle(expr, stage);
    if (type(s) == "string")
	outfi("%s;\n", s);
//    outfi("%s;\t/* %s (%d)  %s (%d) */\n",
//	  handle(o[1], stage),
//	  (o.info && o.info.source) || "?", 
//	  (o.info && o.info.currentline) || -1,
//	  (o.info2 && o.info2.source) || "?", 
//	  (o.info2 && o.info2.currentline) || -1
//	 );
}

goto_kind.ana0 = function(o, stage) {
    for (i, p in ipairs(o)) {
	p = handle(p, stage);
	if (cancast(p, gettype("boolean", globalns)))
	    p = cast(p, gettype("boolean", globalns));
	else
	    emiterror("expected boolean compatible expression");
	o[i] = p;
    }
    return o;
}
goto_kind.code0_write = function(o, stage) {
    if (o[1]) {
	outfi("if (!(%s)) goto %s;\n", handle(o[1], stage), o.target);
    } else
	outfi("goto %s;\n", o.target);
}

label_kind.code0_write = function(o, stage) {
    outfi("%s:;\n", o.label);
}

include "zapi"

function dostage(ns, stage) {
    for (i, s in ipairs({
	"pre",
	stage.."_pre",
	stage,
	"inner",
	stage.."_post",
	"post",
    })) {
	handle(ns, s, stage);
	if (has_error)
	    break;
    }
}

function codegen() {

    setoutput("header");
    out('#include <zc.h>\n\n');
    setoutput("code");
    outfi('#include "%s.h"\n\n', modulename);

    for (_, stage in ipairs { 
	"init0", 
	"ana0", 
	"ana1", 
	"zapi_write",
	"decl0_write", 
	"decl1_write", 
	"decl2_write", 
	"code0_write", 
	"code1_write" }) {
	dostage(namespace, stage);
	if (has_error)
	    break;
    }

    //dump(namespace);
}

;
