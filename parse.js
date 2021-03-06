
labeln = 0;
function newlabel() {
    labeln++;
    return format("__zc_label%d__", labeln);
}

function putstatement(kind, code, s) {
    s.owner = namespace;
    setkind(s, kind);
    table.insert(code, s);
}

function putlabel(code, pos, label) {
    putstatement(label_kind, code, {
	pos = pos,
	label = label,
    });
}

function putgoto(code, pos, label, cond) {
    putstatement(goto_kind, code, {
	cond,
	pos = pos,
	target = label,
	source = savepos(),
    });
}

function processtype(token) {
    if (source.tokentype != "word")
	return token;

    var res = typeref(token);
    token = gettoken();

    if (token == "*") {
	res = setkind({ type = res }, reference_kind);
	token = gettoken();
    }

    return token, res;
}

function checksemicolon(token) {
    if (token != ';')
	emiterror("expected ';'");
    else
	token = gettoken();
    return token;
}

function processterm(token) {
    var res;
    var pos = savepos();

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
    } else if (source.tokentype == "'") {
	res = {
	    target = token,
	};
	setkind(res, number_kind);
	token = gettoken();
    } else if (source.tokentype == '"') {
	res = {
	    target = token,
	};
	setkind(res, string_kind);
	token = gettoken();
    } else if (token == "null") {
	res = {
	    type = typeref("null"),
	    target = "NULL",
	};
	setkind(res, constant_kind);
	token = gettoken();
    } else if (token == "true") {
	res = {
	    type = typeref("boolean"),
	    target = "1",
	};
	setkind(res, constant_kind);
	token = gettoken();
    } else if (token == "false") {
	res = {
	    type = typeref("boolean"),
	    target = "0",
	};
	setkind(res, constant_kind);
	token = gettoken();
    } else if (token == "new") {
	res = {
	};
	setkind(res, new_kind);
	token, res.type = processtype(gettoken());
	if (!res.type)
	    emiterror("type expected");
    } else if (source.tokentype == "word") {
	res = {
	    target = token,
	    owner = namespace,
	};
	setkind(res, memberref_kind);
	token = gettoken();
    } else {
	res = {
	};
	setkind(res, nil_kind);
    }

    res.source = pos;
    return token, res;
}

operators['('].special = function(token, res)
{
    res = {
	func = res,
    }
    setkind(res, call_kind);
    while (token && token != ')') {
	var r;
	token, r = processexpression(token);
	table.insert(res, r);
	if (token != ',' && token != ')') {
	    emiterror("',' or ')' expected");
	    break;
	}
	if (token == ',')
	    token = gettoken();
    }
    return gettoken(), res;
}

function processexpression(token, prio, acceptnil) {
    var res;
    prio = prio or 0;

    var op = preops[token];
    if (op) {
	var pos = savepos();
	var expr;
	token, res = processexpression(gettoken(), op.prio);
	res = {
	    res,
	    op = op,
	    source = pos,
	};
	setkind(res, op.specialkind or op_kind);
	op = preops[token];
	return token, res;
    }
    token, res = processterm(token);

    if (res.kind == "nil") {
	if (!acceptnil) {
	    emiterror("syntax error");
	    token = gettoken();
	}
	return token, res;
    }

    while (true) {
	var op = operators[token];
	
	// binary operators
	if (op && op.prio > prio) {
	    token = gettoken();
	    if (op.special)
		token, res = op.special(token, res);
	    else {
		var pos = savepos();
		token, right = processexpression(token, op.prio2 || op.prio);
		if (right.kind == "nil") {
		    emiterror("missing right operand");
		    token = gettoken();
		}
		res = {
		    res, right,
		    op = op,
		    source = pos,
		};
		setkind(res, op.specialkind or op_kind);
	    }
	} else
	    break;
    }

    return token, res;
}

function processstatement(token, code) {
    var pos = savepos();
    if (token == ";")
	return gettoken();
    else if (token == '{') {
	token = gettoken();
	while (token && token != '}')
	    token = processstatement(token, code);
	if (token != '}')
	    emiterror("'}' expected");
	token = gettoken();
	return token;
    } else if (token == "return") {
	var expr;
	token, expr = processexpression(gettoken(), nil, true);
	putstatement(return_kind, code, {
	    expr,
	    pos = pos,
	    owner = namespace,
	});
	return checksemicolon(token);
    } else if (token == "if") {
	token = gettoken();
	if (token != '(')
	    emiterror("'(' expected");
	else
	    token = gettoken();
	var cond;
	var labeltrue = newlabel();
	var labelfalse = newlabel();
	token, cond = processexpression(token);
	cond.pos = pos;
	if (token != ')')
	    emiterror("')' expected");
	else
	    token = gettoken();

	putgoto(code, pos, labelfalse, cond);

	putlabel(code, pos, labeltrue);

	token = processstatement(token, code);

	var labelfini = labelfalse;
	if (token == "else") {
	    labelfini = newlabel();
	    putgoto(code, pos, labelfini);

	    putlabel(code, pos, labelfalse);

	    token = gettoken();
	    token = processstatement(token, code);
	}
	putlabel(code, pos, labelfini);
	return token;
    } else if (token == "while") {
	token = gettoken();
	if (token != '(')
	    emiterror("'(' expected");
	else
	    token = gettoken();

	var labelloop = newlabel();
	var labelexit = newlabel();
	putlabel(code, pos, labelloop);

	var cond;
	token, cond = processexpression(token);
	cond.pos = pos;
	if (token != ')')
	    emiterror("')' expected");
	else
	    token = gettoken();

	putgoto(code, pos, labelexit, cond);

	token = processstatement(token, code);

	putgoto(code, pos, labelloop);

	putlabel(code, pos, labelexit);

	return token;
	
    } else {
	var s;
	token, s = processdecl(token);
	if (s) {
	    s.owner = namespace;
	    s.pos = pos;
	    table.insert(code, s);
	}
	return token;
    }
}

function processfunc(mods) {
    var params = { };

    var name, type = processtype(gettoken());

    if (!type) {
	emiterror("type expected");
	return name;
    }

    if (source.tokentype != "word") {
	emiterror("variable identifier expected");
	return name;
    }

    var token = gettoken();
    if (token != '(') {
	emiterror("'(' expected");
	return token;
    }
    token = gettoken();

    func = {
	name = name,
	type = type,
	params = params,
	mods = mods,
	source = savepos();
    };
    table.insert(namespace.methods, func);
    setnamespace(func, func_kind);
    pushnamespace(func);

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
	    mods = {},
	};
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
	//emiterror("'{' expected");
	return token;
    }

    func.code = {};
    token = processstatement(token, func.code);

    popnamespace();

    return token;
}

function processclassdecl(mods) {
    var name = gettoken();
    var token = gettoken();

    if (token != "{") {
	emiterror("'}' expected");
	return token;
    }

    var c = {
	name = name,
	mods = mods,
	source = savepos(),
    };
    settype(c, class_kind);
    pushnamespace(c);

    token = gettoken();
    while (token && token != '}')
	token = processdecl(token);

    popnamespace();

    return gettoken();
}

function processvar(mods) {
    var name, type = processtype(gettoken());

    if (!type) {
	emiterror("type expected");
	return name;
    }

    if (source.tokentype != "word") {
	emiterror("variable identifier expected");
	return name;
    }

    var token = gettoken();
    while (true) {
	var v = {
	    name = name,
	    type = type,
	    mods = mods,
	    source = savepos(),
	};
	setkind(v, var_kind);
	setmember(v);
	table.insert(namespace.declarations, v);
	if (token != ',')
	    break;
	name = gettoken();
	if (source.tokentype != "word") {
	    emiterror("variable identifier expected");
	    return name;
	}
	token = gettoken();
    }
    return checksemicolon(token);
}

function processraw(mods) {
    var token = gettoken();
    if (token != "{")
	return token;

    var nb = 1;
    var raw = {
	mods = mods,
	start = savepos(),
    };
    setkind(raw, raw_kind);

    while (token && nb > 0) {
	token = gettoken();
	if (token == "{")
	    nb++;
	if (token == "}")
	    nb--;
    }

    raw.stop = savepos();

    table.insert(namespace.declarations, raw);

    return gettoken();
}

ismod = {
    static = 1,
    final = 1,
    public = 1,
};

function processdecl(token) {

    var mods = { };

    while (token && ismod[token]) {
	mods[token] = 1;
	token = gettoken();
    }

    if (token == "raw")
	return processraw(mods);

    else if (token == "class")
	return processclassdecl(mods);

    else if (token == "func")
	return processfunc(mods);

    else if (token == "var")
	return processvar(mods);

    else {
	var token, s = processexpression(token);
	var expr = { s };
	setkind(expr, expr_kind);
	return checksemicolon(token), expr;
    }
}


function dump(v, i) {
    var dones = { };

    var _dump;

    var rpairs = pairs;
    var pairs = pairs;
    if (i) pairs = ipairs;

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
	    for (k, a in pairs(v)) if (k != "source")
		res = res..string.format("  %s : %s\n"..indent, k, _dump(a, indent.."  "));
	    for (k, a in rpairs(getmetatable(v) or {}))
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
	var expr;
	token, expr = processdecl(token);
	if (expr)
	    emiterror("unexpected expression");
    }

    //dump(namespace);
}


// workaround bug in jslua !!
;
