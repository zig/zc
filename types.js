
function setmeta(meta) {
    meta.__index = function (obj, i) {
	return rawget(obj, i) or meta[i];
    };
}

function setobj(obj, meta) {
    if (!meta.__index)
	setmeta(meta);
    setmetatable(obj, meta);
}
setkind = setobj;

function settype(type, kind) {
    var name = type.name;
    if (types[name])
	emiterror("shadowing existing type");
    type.owner = namespace;
    types[name] = type;
    setkind(type, kind);
}

function gettype(name, ns) {
    ns = ns or namespace;
    var res = ns.types[name];
    if (res)
	return res;
    else if (ns.parent)
	return gettype(name, ns.parent);
    else
	return nil;
}

function setmember(v) {
    var name = v.name;
    if (members[name])
	emiterror("shadowing existing variable");
    v.owner = namespace;
    members[name] = v;
}

function getmember(name, ns) {
    ns = ns or namespace;
    var res = ns.members[name];
    if (res)
	return res;
    else if (ns.parent)
	return getvar(name, ns.parent);
    else
	return nil;
}

namespace_kind = {
    kind = "namespace",
};

ctype_kind = {
    kind = "ctype",
};

class_kind= {
    kind = "class",
};

var_kind = {
    kind = "var",
};

func_kind = {
    kind = "func",
};

return_kind = {
    kind = "return",
};

expr_kind = {
    kind = "expr",
};

op_kind = {
    kind = "op",
};

number_kind = {
    kind = "number",
};

string_kind = {
    kind = "string",
};

memberref_kind = {
    kind = "memberref",
};

nil_kind = {
    kind = "nil",
};


types = { };
members = { };

namespace = {
    members = members,
    types = types,
};
setkind(namespace, namespace_kind);

namespaces = { }

function defctype(name) {
    var t = {
	name = name,
	target = name,
    };
    settype(t, ctype_kind);
}

defctype("int");
defctype("float");
defctype("void");
