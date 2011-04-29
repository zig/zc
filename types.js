
function pushnamespace(ns) {
    table.insert(namespaces, namespace);
    namespace = ns;
    types = ns.types;
    members = ns.members;
}

function popnamespace() {
    namespace = table.remove(namespaces);
    types = namespace.types;
    members = namespace.members;
}

function typeref(name) {
    return {
	kind = "typeref",
	target = name,
    };
}

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
    else if (ns.owner)
	return gettype(name, ns.owner);
    else
	return nil;
}

function setmember(v, ns) {
    var name = v.name;
    ns = ns or namespace;
    if (ns.members[name])
	emiterror("shadowing existing variable");
    v.owner = ns;
    ns.members[name] = v;
}

function getmember(name, ns) {
    ns = ns or namespace;
    var res = ns.members[name];
    if (res)
	return res;
    else if (ns.owner)
	return getmember(name, ns.owner);
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

intrinsicfunc_kind = {
    kind = "func",
};

return_kind = {
    kind = "return",
    default_handlers = 1,
};

expr_kind = {
    kind = "expr",
    default_handlers = 1,
};

op_kind = {
    kind = "op",
    default_handlers = 1,
};

dot_kind = {
    kind = "dot",
    default_handlers = 1,
};

null_kind = {
    kind = "null",
    default_handlers = 1,
};

number_kind = {
    kind = "number",
    default_handlers = 1,
};

string_kind = {
    kind = "string",
    default_handlers = 1,
};

tmpdef_kind = {
    kind = "tmpdef",
    default_handlers = 1,
};
ref_kind = {
    kind = "ref",
    default_handlers = 1,
};
unref_kind = {
    kind = "unref",
    default_handlers = 1,
};

memberref_kind = {
    kind = "memberref",
    //default_handlers = 1,
};

memberget_kind = {
    kind = "memberget",
    default_handlers = 1,
};
memberset_kind = {
    kind = "memberset",
    default_handlers = 1,
};
globalget_kind = {
    kind = "globalget",
    default_handlers = 1,
};
globalset_kind = {
    kind = "globalset",
    default_handlers = 1,
};
localget_kind = {
    kind = "localget",
    default_handlers = 1,
};
localset_kind = {
    kind = "localset",
    default_handlers = 1,
};

call_kind = {
    kind = "call",
    default_handlers = 1,
};

assign_kind = {
    kind = "assign",
    default_handlers = 1,
};

new_kind = {
    kind = "new",
    default_handlers = 1,
};

nil_kind = {
    kind = "nil",
    default_handlers = 1,
};


types = { };
members = { };

namespace = {
    members = members,
    types = types,
    methods = {},
};
globalns = namespace;
setkind(namespace, namespace_kind);

namespaces = { }

function defctype(name) {
    var t = {
	name = name,
	target = name,
	members = {},
	types = {},
    };
    settype(t, ctype_kind);
}

defctype("void");

operators = {
    ['+'] = {
	name = "plus",
	cop = '+',
	prio = 1,
	numeric = 1,
    },
    ['-'] = {
	name = "minus",
	cop = '-',
	prio = 1,
	numeric = 1,
    },
    ['/'] = {
	name = "divise",
	cop = '/',
	prio = 2,
	numeric = 1,
    },
    ['*'] = {
	name = "multiply",
	cop = '*',
	prio = 2,
	numeric = 1,
    },
    ['('] = {
	name = "call",
	cop = '(',
	prio = 9,
    },
    ['='] = {
	name = "assign",
	cop = '=',
	prio = 8.5,
	prio2 = 8.4,
	specialkind = assign_kind,
    },
    ['.'] = {
	name = "dot",
	cop = '.',
	prio = 10,
	specialkind = dot_kind,
    },
};

numbers = { 
    int = 1, 
    float = 2,
    double = 3,
};

for (t1, p1 in pairs(numbers))
    defctype(t1);
for (t1, p1 in pairs(numbers)) {
    for (t2, p2 in pairs(numbers)) {
	var rt;
	if (p1 > p2) rt = t1; else rt = t2;
	//print(rt, t1, t2);
	for (_, o in pairs(operators)) if (o.numeric) {
	    var func = {
		name = "__operator_"..o.name,
		parent = namespace,
		rettype = typeref(rt),
		params = {
		    {
			name = "left",
			type = typeref(t1),
		    },
		    {
			name = "right",
			type = typeref(t2),
		    }
		},
		types = {},
		members = {},
		intrinsic = {

		},
	    }
	    func.members.left = func.params[1];
	    func.members.right = func.params[2];
	    setkind(func, intrinsicfunc_kind);
	    table.insert(namespace.methods, func);
	}
    }
}

;
