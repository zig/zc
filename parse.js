
types = { };
vars = { };

namespace = {
    kind = "namespace",
    vars = vars,
    types = types,
};

namespaces = { }

function pushnamespace(ns) {
    table.insert(namespaces, namespace);
    namespace = ns;
    types = ns.types;
    vars = ns.vars;
}

function popnamespace() {
    namespace = table.remove(namespaces);
    types = namespace.types;
    vars = namespace.vars;
}

function settype(name, type) {
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

function processtype(token) {
    if (source.tokentype != "word")
	return token;
    var name = token;
    var t = gettype(name);
    if (!t) {
	t = {
	    name = name,
	    incomplete = true
	};
    }
    token = gettoken();
    return token, t;
}

function checksemicolon(token) {
    if (token != ';')
	emiterror("expected ';'");
    //else
	token = gettoken();
    return token;
}

function processterm(token) {
    var res;

    if (token == '(') {
	token, res = processexpression(gettoken(), 0);
	if (token != ')')
	    emiterror("')' expected");
	else
	    token = gettoken();
    } else if (source.tokentype == "number") {
	res = {
	    kind = "constant",
	    target = token,
	};
	token = gettoken();
    } else if (source.tokentype == "word") {
	res = {
	    kind = "varref",
	    target = token,
	};
	token = gettoken();
    } else
	res = {
	    kind = "nil";
	};

    return token, res;
}

operators = {
    ['+'] = {
	name = '+',
	prio = 1,
    },
    ['-'] = {
	name = '-',
	prio = 1,
    },
    ['/'] = {
	name = '/',
	prio = 2,
    },
    ['*'] = {
	name = '*',
	prio = 2,
    },
    ['.'] = {
	name = '.',
	prio = 10,
    },
};

function processexpression(token, prio) {
    var res;
    prio = prio or 0;

    token, res = processterm(token);

    while (true) {
	var op = operators[token];
	
	// binary operators
	if (op && op.prio >= prio) {
	    token, right = processexpression(gettoken(), op.prio);
	    res = {
		res, right,
		kind = "op",
		op = op,
	    };
	} else
	    break;
    }

    return token, res;
}

function processstatement(token) {
    if (token == '{')
	return processblock(token);
    if (token == "return") {
	var r = {
	    kind = "return",
	};
	token, r.value = processexpression(gettoken());
	return token, r;
    }
    return processdecl(token);
}

function processblock(token) {
    var code = { };
    var s;
    if (token == '{') {
	token = gettoken();
	while (token != '}') {
	    token, s = processstatement(token);
	    table.insert(code, s);
	}
	token = gettoken();
    } else {
	token, s = processstatement(token);
	table.insert(code, s);
    }

    return token, code;
}

function processfunc(funcname, rettype) {
    var params = { };
    var token = gettoken();
    while (token != ')') {
	var type;
	token, type = processtype(token);

	if (!type) {
	    emiterror("type expected");
	    return token;
	}

	if (!gettype(type.name))
	    settype(type.name, type);

	if (source.tokentype != "word") {
	    emiterror("identifier expected");
	    return token;
	}
	table.insert(params, {
	    name = token,
	    type = type,
	});
	token = gettoken();
	if (token != ',' && token != ')') {
	    emiterror("',' or ')' expected");
	    return token;
	}
	if (token == ')')
	    break;
	token = gettoken();
    }
    
    token = gettoken();
    if (token != '{') {
	emiterror("'{' expected");
	return token;
    }

    func = {
	name = funcname,
	kind = "function",
	parent = namespace,
	rettype = rettype,
	params = params,
	types = {},
	vars = {},
    }
    setvar(funcname, func);

    pushnamespace(func);

    var code;
    token, code = processblock(token);

    func.code = code;

    popnamespace();

    return token;
}

function processclassdecl() {
    var name = gettoken();
    var token = gettoken();

    if (token != "{") {
	emiterror("'}' expected");
	return token;
    }

    var c = {
	kind = "class",
	name = name,
	vars = {},
	types = {},
	parent = namespace,
    };
    settype(name, c);
    pushnamespace(c);

    token = gettoken();
    while (token && token != '}')
	token = processdecl(token);

    popnamespace();

    return gettoken();
}

function processdecl(token) {

    var pos = savepos(source);
    if (token == "class")
	return processclassdecl(token);

    var type;
    token, type = processtype(token);

    if (!type || source.tokentype != "word") {
	token = gotopos(source, pos);
	token, s = processexpression(token);
	return checksemicolon(token), s;
    }
    if (!gettype(type.name))
	settype(type.name, type);

    var name = token;
    token = gettoken();

    if (token == '(') { // function declaration
	token = processfunc(name, type);
    } else { // this is a variable
	var v = {
	    name = name,
	    kind = "variable",
	    type = type,
	};
	setvar(name, v);
	while (token == ',') {
	    name = gettoken();
	    if (tokentype != "word") {
		emiterror("identifier expected");
		return token;
	    }
	    v = {
		name = name,
		kind = "variable",
		type = type,
	    };
	    setvar(name, v);
	    token = gettoken();
	}
	token = checksemicolon(token);
    }

    return token;
}


function dump(v) {
    var dones = { };

    var _dump;

    _dump = function(v, indent) {
	var res;
	if (v == nil)
	    res = 'nil';
	else if (type(v) == "table") {
	    if (dones[v]) {
		if (v.name)
		    return string.format("see '%s' above", v.name);
		else
		    return "see above";
	    }
	    dones[v] = 1;
	    res = "{\n"..indent;
	    for (k, a in pairs(v))
		res = res..string.format("  %s : %s\n"..indent, k, _dump(a, indent.."  "));
	    res = res.."}";
	} else
	    res = tostring(v);
	return res;
    }

    print (_dump(v, ""));
}

function processsource(source) {
    var token = gettoken(source);
    while (token) {
	token = processdecl(token);
    }

    dump(vars);
    dump(types);
}


// workaround bug in jslua !!
_ = nil;
