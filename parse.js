
types = { };
vars = { };

namespace = {
    kind = "namespace",
    vars = vars,
    types = types,
};

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

function getvar(name) {
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
    var name = token;
    var t = gettype(name);
    if (!t) {
	t = {
	    name = name,
	    incomplete = true
	};
	settype(name, t);
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
    return processexpression(token);
}

function processblock(token) {
    var code = { };
    var s;
    if (token == '{') {
	token = gettoken();
	while (token != '}') {
	    token, s = processstatement(token);
	    table.insert(code, s);
	    token = checksemicolon(token);
	}
	token = gettoken();
    } else {
	token, s = processstatement(token);
	table.insert(code, s);
	token = checksemicolon(token);
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
	rettype = rettype,
	params = params,
    }
    setvar(funcname, func);

    var code;
    token, code = processblock(token);

    func.code = code;

    return token;
}

function processdecl(token) {
    var type;
    token, type = processtype(token);

    if (!type) {
	emiterror("type expected");
	return token;
    }

    if (source.tokentype != "word") {
	emiterror("identifier expected");
	return token;
    }
    var name = token;
    token = gettoken();

    if (token == '(') { // function declaration
	token = processfunc(name, type);
    } else { // this is a variable
	var v = {
	    name = name,
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
    while (token)
	token = processdecl(token);

    dump(vars);
}


// workaround bug in jslua !!
_ = nil;
