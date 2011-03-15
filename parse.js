
types = { }
vars = { }

function gettype(source, token) {
    var name = token;
    var t = types[tid];
    if (!t) {
	t = {
	    name = name,
	    incomplete = true
	};
	types[tid] = t;
    }
    token = gettoken(source);
    return token, t;
}

function processterm(source, token) {
    var res;
    if (source.tokentype == "word") {
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

function processoperation(source, token, res, prio) {

    return token, res
}

function processexpression(source, token, prio) {
    var res;
    prio = prio or 0

    if (token == '(') {
	token, res = processexpression(source, gettoken(source), 0);
	if (token != ')')
	    emiterror("')' expected", source);
	else
	    token = gettoken(source);
	return token, res;
    }

    token, res = processterm(source, token);

    var op = operators[token]

    // binary operators
    if (op && op.prio >= prio) {
	token, right = processexpression(source, gettoken(source), op.prio);
	res = {
	    res, right,
	    kind = "op",
	    op = op,
	};
    }

    return token, res
}

function processstatement(source, token) {
    return processexpression(source, token);
}

function processblock(source, token) {
    var code = { }
    var s
    if (token == '{') {
	token = gettoken(source);
	while (token != '}') {
	    token, s = processstatement(source, token);
	    table.insert(code, s)
	    if (token != ';' && token != '}') {
		emiterror("';' or '}' expected", source);
		return token, code;
	    }
	}
    } else {
	token, s = processstatement(source, token)
	table.insert(code, s)
	if (token != ';') {
	    emiterror("';' expected", source);
	}
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
    }
    
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
	token = processfunc(source, name, type)
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
    }    

    return token;
}




function processsource(source) {
    var token = gettoken(source);
    while (token)
	token = processdecl(source, token);
}


// workaround bug in jslua !!
_ = nil
