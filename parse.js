
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
function processtype(token) {
    if (source.tokentype != "word")
	return token;
    var name = token;
    t = {
	kind = "typeref",
	target = name,
    };
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
	    target = token,
	};
	setkind(res, number_kind);
	token = gettoken();
    } else if (source.tokentype == "string") {
	res = {
	    target = token,
	};
	setkind(res, string_kind);
	token = gettoken();
    } else if (source.tokentype == "word") {
	res = {
	    target = token,
	};
	setkind(res, memberref_kind);
	token = gettoken();
    } else {
	res = {
	};
	setkind(res, nil_kind);
    }

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
		op = op,
	    };
	    setkind(res, op_kind);
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
	};
	setkind(r, return_kind);
	token, r[1] = processexpression(gettoken());
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

    func = {
	name = funcname,
	parent = namespace,
	rettype = rettype,
	params = params,
	types = {},
	members = {},
    }
    setkind(func, func_kind);
    setmember(func);

    pushnamespace(func);

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
	var param = {
	    name = token,
	    type = type,
	    param_index = #params + 1,
	}
	setkind(param, var_kind);
	setmember(param);
	table.insert(params, param);
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
	popnamespace();
	emiterror("'{' expected");
	return token;
    }

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
	name = name,
	members = {},
	types = {},
	parent = namespace,
    };
    settype(c, class_kind);
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
	var expr = { s };
	setkind(expr, expr_kind);
	return checksemicolon(token), expr;
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
	setkind(v, var_kind);
	setmember(v);
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
	    setkind(v, var_kind);
	    setmember(v);
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
	    for (k, a in pairs(getmetatable(v) or {}))
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

    dump(namespace);
}


// workaround bug in jslua !!
;
