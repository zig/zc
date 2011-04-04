
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

function settype(type) {
    var name = type.name;
    if (types[name])
	emiterror("shadowing existing type");
    types[name] = type;
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

function setvar(name, v) {
    if (vars[name])
	emiterror("shadowing existing variable");
    vars[name] = v;
}

function getvar(name, ns) {
    ns = ns or namespace;
    var res = ns.vars[name];
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

types = { };
vars = { };

namespace = {
    vars = vars,
    types = types,
};
setobj(namespace, namespace_kind);

namespaces = { }

function defctype(name) {
    var t = {
	name = name,
	target = name,
    };
    settype(t);
    setkind(t, ctype_kind);
}

defctype("int");
defctype("float");
