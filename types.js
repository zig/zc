
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
    if (type(name) != "string")
	return name;
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

function newcaster(t1, t2) {
    if (type(t1) == "string")
	t1 = gettype(t1, globalns);
    var func = {
	name = "__init",
	parent = t1,
	rettype = t1,
	params = {
	    {
		name = "right",
		type = typeref(t2),
	    }
	},
	types = {},
	members = {},
	intrinsic = {
	    
	},
	mods = {},
    };
    func.members.right = func.params[1];
    setkind(func, intrinsicfunc_kind);
    table.insert(t1.methods, func);

    return func;
}

function newop(name, rt, ...) {
    var func = {
	name = "__operator_"..name,
	parent = namespace,
	rettype = typeref(rt),
	params = {},
	types = {},
	members = {},
	intrinsic = {
	    
	},
	mods = {},
    };

    for (i, t in ipairs { ... }) {
	var p = {
	    name = format("p%d", i),
	    type = typeref(t),
	};
	table.insert(func.params, p);
	setmember(p, func);
    }

    setkind(func, intrinsicfunc_kind);
    table.insert(namespace.methods, func);
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

boolean_kind = {
    kind = "boolean",
    default_handlers = 1,
};

null_kind = {
    kind = "null",
    default_handlers = 1,
};

constant_kind = {
    kind = "constant",
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

type_kind = {
    kind = "type",
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
    default_handlers = 1,
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
	methods = {},
    };
    settype(t, ctype_kind);
    return t;
}

defctype("void");

unaries = {
    ['!'] = {
	name = "not",
	cop = '!',
	boolean = true,
    },
    ['-'] = {
	name = "negate",
	cop = '-',
	numeric = true,
    },
    ['~'] = {
	name = "lnot",
	cop = '~',
	numeric = true,
    },
}

operators = {
    ['+'] = {
	name = "plus",
	cop = '+',
	prio = 1,
	numeric = true,
    },
    ['-'] = {
	name = "minus",
	cop = '-',
	prio = 1,
	numeric = true,
    },
    ['/'] = {
	name = "divise",
	cop = '/',
	prio = 2,
	numeric = true,
    },
    ['*'] = {
	name = "multiply",
	cop = '*',
	prio = 2,
	numeric = true,
    },
    ['='] = {
	name = "assign",
	cop = '=',
	prio = 2.5,
	prio2 = 2.4,
	specialkind = assign_kind,
    },
    ['=='] = {
	name = "equal",
	cop = '==',
	prio = 4,
	comparison = true,
    },
    ['!='] = {
	name = "different",
	cop = '!=',
	prio = 4,
	comparison = true,
    },
    ['&&'] = {
	name = "and",
	cop = '&&',
	prio = 3,
	boolean = true,
    },
    ['||'] = {
	name = "or",
	cop = '||',
	prio = 3,
	boolean = true,
    },
    ['('] = {
	name = "call",
	cop = '(',
	prio = 9,
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

var t = {
    name = "null",
    members = {},
    types = {},
    methods = {},
};
settype(t, null_kind);

var t = {
    name = "boolean",
    members = {},
    types = {},
    methods = {},
};
settype(t, boolean_kind);

for (t1, p1 in pairs(numbers)) {
    var t = defctype(t1);
    newcaster("boolean", t);
    for (_, o in pairs(unaries)) if (o.numeric)
	newop(o.name, t1, t1);
}
for (t1, p1 in pairs(numbers)) {
    for (t2, p2 in pairs(numbers)) {
	var rt;
	if (p1 > p2) rt = t1; else rt = t2;
	//print(rt, t1, t2);
	for (_, o in pairs(operators)) {
	    if (o.numeric)
		newop(o.name, rt, t1, t2);
	    if (o.comparison)
		newop(o.name, "boolean", t1, t2);
	}
	newcaster(t1, t2).intrinsic.call_write = function(o, stage) {
	    return format("((%s) %s)", t1, handle(o[1], stage));
	};
    }
}

newop("equal", "boolean", "null", "null");
newop("different", "boolean", "null", "null");
newop("and", "boolean", "boolean", "boolean");
newop("or", "boolean", "boolean", "boolean");
newop("not", "boolean", "boolean");
newcaster("boolean", "null");


;
