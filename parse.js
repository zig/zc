
types = { };
vars = { };

function gettype(source, token) {
    var name = token;
    var t = types[name];
    if (!t) {
	t = {
	    name = name,
	    incomplete = true
	};
	types[name] = t;
    }
    token = gettoken(source);
    return token, t;
}

function checksemicolon(source, token) {
    if (token != ';')
	emiterror("expected ';'", source);
    //else
	token = gettoken(source);
    return token;
}

function processterm(source, token) {
    var res;

    if (token == '(') {
	token, res = processexpression(source, gettoken(source), 0);
	if (token != ')')
	    emiterror("')' expected", source);
	else
	    token = gettoken(source);
    } else if (source.tokentype == "word") {
	res = {
	    kind = "varref",
	    target = token,
	};
	token = gettoken(source);
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

function processexpression(source, token, prio) {
    var res;
    prio = prio or 0;

    token, res = processterm(source, token);

    while (true) {
	var op = operators[token];
	
	// binary operators
	if (op && op.prio >= prio) {
	    token, right = processexpression(source, gettoken(source), op.prio);
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

function processstatement(source, token) {
    return processexpression(source, token);
}

function processblock(source, token) {
    var code = { };
    var s;
    if (token == '{') {
	token = gettoken(source);
	while (token != '}') {
	    token, s = processstatement(source, token);
	    table.insert(code, s);
	    token = checksemicolon(source, token);
	}
	token = gettoken(source);
    } else {
	token, s = processstatement(source, token);
	table.insert(code, s);
	token = checksemicolon(source, token);
    }

    return token, code;
}

function processfunc(source, funcname, rettype) {
    var params = { };
    var token = gettoken(source);
    while (token != ')') {
	var type;
	token, type = gettype(source, token);

	if (!type) {
	    emiterror("type expected", source);
	    return token;
	}

	if (source.tokentype != "word") {
	    emiterror("identifier expected", source);
	    return token;
	}
	table.insert(params, {
	    name = token,
	    type = type,
	});
	token = gettoken(source);
	if (token != ',' && token != ')') {
	    emiterror("',' or ')' expected", source);
	    return token;
	}
	if (token == ')')
	    break;
	token = gettoken(source);
    }
    
    token = gettoken(source);
    if (token != '{') {
	emiterror("'{' expected", source);
	return token;
    }

    func = {
	name = funcname,
	rettype = rettype,
	params = params,
    }
    vars[funcname] = func;

    var code;
    token, code = processblock(source, token);

    func.code = code;

    return token;
}

function processdecl(source, token) {
    var type;
    token, type = gettype(source, token);

    if (!type) {
	emiterror("type expected", source);
	return token;
    }

    if (source.tokentype != "word") {
	emiterror("identifier expected", source);
	return token;
    }
    var name = token;
    token = gettoken(source);

    if (token == '(') { // function declaration
	token = processfunc(source, name, type);
    } else { // this is a variable
	var v = {
	    name = name,
	    type = type,
	};
	vars[name] = v;
	while (token == ',') {
	    name = gettoken(source);
	    if (source.tokentype != "word") {
		emiterror("identifier expected", source);
		return token;
	    }
	    v = {
		name = name,
		type = type,
	    };
	    vars[name] = v;
	    token = gettoken(source);
	}
	token = checksemicolon(source, token);
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
	token = processdecl(source, token);

    dump(vars);
}


// workaround bug in jslua !!
_ = nil;
