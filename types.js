
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

var rtypes = { };
function referencetype(type) {
    var res = rtypes[type];
    if (!res) {
	print("new reference type", type.name);
	res = setkind({ type = type }, reference_kind);
	res.__subtype = type;
	rtypes[type] = res;
    }
    return res;
}

function setmeta(meta) {
    meta.__index = function (obj, i) {
	var res = rawget(obj, i) or meta[i];
	if (res) return res;
	var sub = rawget(obj, "__subtype");
	return sub and sub[i];
    };
}

function setkind(obj, meta) {
    if (!meta.__index)
	setmeta(meta);
    setmetatable(obj, meta);
    return obj;
}

function setnamespace(ns, kind) {
    ns.owner = namespace;
    ns.types = ns.types || {};
    ns.members = ns.members || {};
    ns.methods = ns.methods || {};
    ns.declarations = ns.declarations || {};
    setkind(ns, kind);
}

function settype(type, kind) {
    var name = type.name;
    if (types[name])
	emiterror("shadowing existing type");
    types[name] = type;
    setnamespace(type, kind);
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
	type = t1,
	params = {
	    {
		name = "right",
		type = typeref(t2),
	    }
	},
	intrinsic = {
	    
	},
	mods = {},
    };
    setnamespace(func, intrinsicfunc_kind);
    func.members.right = func.params[1];
    table.insert(t1.methods, func);

    return func;
}

function newop(name, rt, ...) {
    var func = {
	name = "__operator_"..name,
	type = typeref(rt),
	params = {},
	intrinsic = {
	    
	},
	mods = {},
    };
    setnamespace(func, intrinsicfunc_kind);

    for (i, t in ipairs { ... }) {
	var p = {
	    name = format("p%d", i),
	    type = typeref(t),
	};
	table.insert(func.params, p);
	setmember(p, func);
    }

    table.insert(namespace.methods, func);
}
    
function defctype(name) {
    var t = {
	name = name,
	target = name,
    };
    settype(t, ctype_kind);
    return t;
}

raw_kind = {
    kind = "raw",
};

namespace_kind = {
    kind = "namespace",
};

ctype_kind = {
    kind = "ctype",
    default_handlers = 1,
};

class_kind = {
    kind = "class",
    default_handlers = 1,
};

reference_kind = {
    kind = "reference",
    default_handlers = 1,
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

goto_kind = {
    kind = "goto",
    default_handlers = 1,
};

label_kind = {
    kind = "label",
    default_handlers = 1,
};

preops = {
    ['!'] = {
	name = "not",
	cop = '!',
	prio = 10.5,
	boolean = true,
    },
    ['+'] = {
	name = "nop", // this is just a pointless operator ...
	cop = '+',
	prio = 10.5,
	numeric = true,
    },
    ['-'] = {
	name = "negate",
	cop = '-',
	prio = 10.5,
	numeric = true,
    },
    ['~'] = {
	name = "nnot",
	cop = '~',
	prio = 10.5,
	numeric = true,
    },
}

operators = {
    ['='] = {
	name = "assign",
	cop = '=',
	prio = 0.5,
	prio2 = 0.4,
	specialkind = assign_kind,
    },
    ['||'] = {
	name = "or",
	cop = '||',
	prio = 1,
	boolean = true,
    },
    ['&&'] = {
	name = "and",
	cop = '&&',
	prio = 2,
	boolean = true,
    },
    ['|'] = {
	name = "nor",
	cop = '|',
	prio = 3,
	numeric = true,
    },
    ['^'] = {
	name = "xor",
	cop = '^',
	prio = 4,
	numeric = true,
    },
    ['&'] = {
	name = "nand",
	cop = '&',
	prio = 5,
	numeric = true,
    },
    ['=='] = {
	name = "equal",
	cop = '==',
	prio = 6,
	comparison = true,
    },
    ['!='] = {
	name = "different",
	cop = '!=',
	prio = 6,
	comparison = true,
    },
    ['>'] = {
	name = "gt",
	cop = '>',
	prio = 7,
	comparison = true,
    },
    ['>='] = {
	name = "ge",
	cop = '>=',
	prio = 7,
	comparison = true,
    },
    ['<'] = {
	name = "lt",
	cop = '<',
	prio = 7,
	comparison = true,
    },
    ['<='] = {
	name = "le",
	cop = '<=',
	prio = 7,
	comparison = true,
    },
    ['<<'] = {
	name = "lshift",
	cop = '<<',
	prio = 8,
	numeric = true,
    },
    ['>>'] = {
	name = "rshift",
	cop = '>>',
	prio = 8,
	numeric = true,
    },
    ['+'] = {
	name = "plus",
	cop = '+',
	prio = 9,
	numeric = true,
    },
    ['-'] = {
	name = "minus",
	cop = '-',
	prio = 9,
	numeric = true,
    },
    ['/'] = {
	name = "divise",
	cop = '/',
	prio = 10,
	numeric = true,
    },
    ['%'] = {
	name = "modulo",
	cop = '%',
	prio = 10,
	numeric = true,
    },
    ['*'] = {
	name = "multiply",
	cop = '*',
	prio = 10,
	numeric = true,
    },
    ['('] = {
	name = "call",
	cop = '(',
	prio = 11,
    },
    ['.'] = {
	name = "dot",
	cop = '.',
	prio = 12,
	specialkind = dot_kind,
    },
};

var numbers = { 
    int = 1, 
    float = 2,
    double = 3,
};

namespaces = { };

globalns = {};
setnamespace(globalns, namespace_kind);
pushnamespace(globalns);

defctype("void");

var t = {
    name = "null",
};
settype(t, null_kind);

var t = {
    name = "boolean",
};
settype(t, boolean_kind);

for (t1, p1 in pairs(numbers)) {
    var t = defctype(t1);
    newcaster("boolean", t);
    for (_, o in pairs(preops)) 
	if (o.numeric)
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

newcaster("boolean", "boolean");
for (_, o in pairs(preops)) 
    if (o.boolean)
	newop(o.name, "boolean", "boolean");
for (_, o in pairs(operators))
    if (o.boolean || o.comparison)
	newop(o.name, "boolean", "boolean", "boolean");

newop("equal", "boolean", "null", "null");
newop("different", "boolean", "null", "null");
newcaster("boolean", "null");


;
