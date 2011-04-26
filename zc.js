#! /usr/local/bin/lua-5.1
/*
 * zc - Ziggy's new C language
 *
 * @author : Vincent Penné (ziggy at zlash dot com)
 *
 */

if (arg[0]) standalone = 1;

// useful shortcut
format = string.format;

// lua namespaces
function enter_namespace(name) {
	var parent = getfenv(2);
	var namespace = { parent_globals = parent };

	var i, v;
	for (i, v in pairs(parent))
		if (i != "parent_globals")
			namespace[i] = v;
	
	parent[name] = namespace;
	namespace[name] = namespace;

	setfenv(2, namespace);
}

function exit_namespace() {
	var parent = getfenv(2);
	setfenv(2, parent.parent_globals);
}


// enter in zc namespace
enter_namespace("zc");


// all single symbol tokens in js
var symbols = "~!#%%%^&*()%-%+=|/%.,<>:;\"'%[%]{}%?";
var symbolset = "["..symbols.."]";
var msymbols = "<>!%&%*%-%+%=%|%/%%%^%.";
var msymbolset = "["..msymbols.."]";
var nospace = {
	["~"] = 1,
	["#"] = 1,
};


// paths
var paths = {
	"",
};

function add_path(path) {
	table.insert(paths, path);
}

var loadfile_orig = loadfile;
function loadfile(name) {
	var module, error;
	for (_, path in pairs(paths)) {
		//emiterror(format("Trying '%s'", path..name));
		module, error = loadfile_orig(path..name);
		if (module) {
			setfenv(module, getfenv(2));
			break;
		}
	}
	return module, error;
}


function _message(msg) {
	io.stdout:write(msg.."\n");
}

function message(msg) {
	if (verbose)
		_message(msg);
}

function dbgmessage(msg) {
	if (dbgmode)
		_message(msg);
}

// emit an error, optionally print information about status in source where the error occured
function emiterror(msg, psource) {
	var p="";
	psource = psource || source;
	if (source)
    		p = format("%s (%d) at token '%s' : ", source.filename, source.nline || -1, source.token || "<null>");
	_message(p..msg);
	has_error = 1;
	num_error = (num_error || 0) + 1;
}


// collapse an array of strings into one string, lua-efficiently (lua sucks at string concatenations)
function collapse(t) {
	var i, n;
	while (t[2]) {
		n = #t;
		var t2 = { };
		for (i=1,n,2)
			table.insert(t2, t[i]..(t[i+1] || ""));
		t = t2;
	}
	return t[1] || "";
}

function opensource(realfn, filename) {
  
	var source = { };

	source.filename = filename;
	if (standalone) {
		if (realfn)
			source.handle = io.open(filename, "r");
		else
			source.handle = io.stdin;
		if (!source.handle) {
			emiterror(format("Can't open source '%s'", filename));
			return nil;
		}
	} else {
		source.buffer = gBuffer;
		source.bufpos = 1;
	}
  
	source.nline = 0;
	source.ntoken = 0;
	source.tokens = { };
	source.tokentypes = { };
	source.tokenlines = { };
	source.tokencomments = { };
  
	var token = basegettoken(source);
	while (token) {
		//print(token, source.tokentype);
		table.insert(source.tokens, token);
		table.insert(source.tokentypes, source.tokentype);
		table.insert(source.tokenlines, source.nline);
		source.ntoken++;
		token = basegettoken(source);
	}
	source.tokenpos = 1;
  
	return source;
  
}

function closesource(source) {
	if (standalone) {
		source.handle:close();
		source.handle = nil;
	}
	source = nil;
}

function getline(source) {
	if (standalone)
		source.linebuffer = source.handle:read("*l");
	else {
		if (!source.bufpos) return;
		var i = string.find(source.buffer, "\n", source.bufpos);
		source.linebuffer = string.sub(source.buffer, source.bufpos, (i || 0) - 1);
		source.bufpos = i && (i+1);
	}

	source.nline++;
	source.newline = 1;
	//dbgmessage(format("%d %s", source.nline, source.linebuffer));
}

function savepos(source) {
	return source.tokenpos;
}

function gotopos(source, pos) {
	source.tokenpos = pos-1;
	return gettoken(source);
}

function gettoken(psource) {
	source = psource or source;
	var source = source;
	var pos = source.tokenpos;
	var token = source.tokens[pos];
	source.token = token;
	source.tokentype = source.tokentypes[pos];
	source.nline = source.tokenlines[pos];
	if (!token)
		return;
	source.tokenpos = pos + 1;

	//message(format("\015%d", source.nline));
	dbgmessage(token);

	if (source.tokentype == "comment") {
		if (!source.tokencomments[source.tokenpos - 1]) {
			out(string.gsub("// "..token, "\n", output.curindent.."\n//").."\n");
			source.tokencomments[source.tokenpos - 1] = 1;
		}
		return gettoken(source);
	}

	return token;
}

// This could be rewritten more efficiently in C
function basegettoken(source) {
	var newline;
	
	var tokens;
	
	if (!source.linebuffer) {
		newline = 1;
		getline(source);
		if (!source.linebuffer)
			return nil;
	} else
		source.newline=nil;
	
	var i,j;
	
	// remove starting spaces
	var s = source.linebuffer;
	i = string.find(s, "%S");
	if (!i) {
		// we reached the end of the line
		source.linebuffer = nil;
		return basegettoken(source); // tail call so it's fine
	}
	j = string.find(s, "[%s"..symbols.."]", i);
	if (!j)
		j = string.len(s) + 1;
	else
		j--;
	
	source.stick = (i==1);
	source.tokentype="word";
	if (i != j) {
		var c = string.sub(s, i, i);
		if (string.find(c, symbolset)) {
			j = i;
			while (string.find(string.sub(s, j+1, j+1), msymbolset) && 
			       string.find(c, msymbolset))
				j++;
			source.tokentype=string.sub(s, i, j);
		} else if (string.find(string.sub(s, j-1, j), symbolset))
			j--;
	}
	
	token = string.sub(s, i, j);
	source.token = token;
	source.linebuffer=string.sub(s, j+1);
	
	if (token == "\"" || token == "'") {
		// string
		var t = token;
		s = source.linebuffer;
		var ok;
		while(!ok) {
			var _, k;
			_,k = string.find(s, t);
			while (k && k>1) {
				var l = k-1;
				var n = 0;
				while (l>0 && string.sub(s, l, l)=="\\") {
					l--;
					n += 0.5;
				}
				if (n > 0)
					dbgmessage(format("N = %g (%g) '%s'", n, math.floor(n), 
							  source.linebuffer));
				if (math.floor(n) == n) 
					break;
				_,k = string.find(s, t, k+1);
			}
			if (k) {
				token = token..string.sub(s, 1, k);
				source.linebuffer=string.sub(s, k+1);
				dbgmessage(format("TOKEN(%s) REST(%s), k(%d)", token, source.linebuffer, k+1));
				ok = 1;
			} else {
				token = token..string.sub(s, 1, -2);
				getline(source);
				if (!source.linebuffer)
					return nil;
				s = source.linebuffer;
			}
		}
		
		source.tokentype=t;
	}
	
	if (token == "//" || (source.newline && token == "#")) {
		// end of line commentary
		getline(source);
		//source.tokentype = "comment";
		//token = string.sub(s, j+2);
		return basegettoken(source);
	}
	if (token == "/*") {
		// block comment
		var _, k;
		_, k = string.find(s, "*/", j+2);
		token = "";
		while (!k) {
			token = token..string.sub(s, j+2).."\n";
			getline(source);
			s = source.linebuffer;
			if (!s)
				return nil;
			_, k = string.find(s, "*/");
			j = -1;
		}
		source.linebuffer = string.sub(s, k+1);
		source.tokentype = "comment";
		token = token..string.sub(s, j+2, k-1);
		//return basegettoken(source);
	}
	
	if (source.tokentype == "word" && !string.find(token, "[^0123456789%.]")) {
		source.tokentype = "number";
		var s = source.linebuffer;
		if (string.sub(s, 1, 1) == ".") {
			var i = string.find(s, "%D", 2);
			if (i) {
				source.linebuffer = string.sub(s, i);
				i--;
			} else
				source.linebuffer = nil;
			token = token..string.sub(s, 1, i);
			//message(format("FLOAT %s line %d", token, source.nline));
		}
	}
	return token;
}

function include(name) {
    var module, error = loadfile(name..".lua");
    if (module) {
	message(format("Included '%s'", name));
	module();
    } else {
	emiterror(format("Could not load module '%s'", name));
	message(error);
    }
}

include("types");
include("parse");
include("codegen");

// modules
function loadmodule(name, ns) {
	var mname = "mod_"..name;

	var ons = getfenv();
	if (ns)
		setfenv(1, ns);

	enter_namespace(mname);
	var table = getfenv();
	var module, error = loadfile(name..".lua");
	if (module) {
		message(format("Module '%s' loaded", name));
		setfenv(module, table); // why do I need to do this ??
		module();
		add_options(table.options);
	} else {
		emiterror(format("Could not load module '%s'", name));
		message(error);
		table = nil;
	}

	exit_namespace();

	setfenv(1, ons);

	return table;
}


function zc(f) {

	has_error = nil;
	num_error = 0;
  
	var filename = f || "stdin";
	message ("Reading from "..filename);
	var source = opensource(f, filename);
  
	if (!source)
		return "";
  
	message (format("%d lines, %d tokens", source.nline, source.ntoken));
	message ("Processing "..filename);
	processsource(source);

	closesource(source);

	if (has_error) {
		message(format("%d error(s) while compiling", num_error));
		return "";
	} else
		message(format("no error while compiling"));

	codegen();

	writeoutputs();
}

function dofile(file) {
	var source = zc(file);
	var module, error = loadstring(source);
	source = nil; // allow source to be garbage collected
	if (module) {
		//setfenv(module, table); // why do I need to do this ??
		module();
	} else {
		emiterror(format("Could not load string"));
		message(error);
	}
}

// postprocess
postprocess = { };

function do_postprocess() {
	for (_, v in pairs(postprocess))
		v();
}

function add_postprocess(f) {
	table.insert(postprocess, f);
}


// output
outputs = { };
function newoutput(name, filename) {
    o = {
	filename = filename,
	curindent = "",
	indentstring = "   ",
	indentlevel = 0,
    };
    outputs[name] = o;
}

function setoutput(name) {
    output = outputs[name];
}

function writeoutputs() {
    var k, o;
    for (k, o in pairs(outputs)) {
	var f = io.open(o.filename, "w");
	f:write(collapse(o));
    }
}

newoutput("header", "a.h");
newoutput("code", "a.c");
setoutput("code");

function out(s) {
    s = string.gsub(s, "\t", output.curindent);
    table.insert(output, s);
}
function outf(...) {
    var s = format(...);
    out(s);
}

function get_outcurindent() {
    return output.curindent;
}

function outi() {
	out(output.curindent);
}

function outfi(...) {
    outi();
    outf(...);
}

var line = 1;
function outnl() {
	line++;
	out("\n");
}

function outindent(l) {
	output.indentlevel += l;
	output.curindent = string.rep(output.indentstring, output.indentlevel);
}

// help
function option_list(opt) {
	for (i, v in pairs(opt))
		emiterror(i.." "..v.help);
}

function option_help() {
	print("usage : zc [options] [filenames]");
	option_list(options);
	os.exit();
}

// option module
function option_module() {
	var name = option_getarg();

	loadmodule(name);
}

options = {
	["-v"] = {
		call = function() { verbose = 1; },
		help = "turn verbose mode on"
	},
	["-d"] = {
		call = function() { dbgmode = 1; },
		help = "turn debug mode on"
	},
	["--module"] = {
		call = option_module,
		help = "<modulename> load a module"
	},
	
	["--help"] = {
		call = option_help,
		help = "display this help message"
	}
};


function add_options(table) {
	for (i, v in pairs(table)) {
		if (options[i])
			emiterror(format("Option '%s' overriden", i));
		options[i] = v;
	}
}

function option_getarg() {
	var arg = option_args[option_argind];
	option_argind++;
	return arg;
}

// exit zc namespace
exit_namespace();


// MAIN ENTRY
if (standalone) {

	// compute installation path from executable name
	var name = arg[0];
	if (name) {
		var i = 0;
		var j;
		while (i != nil) {
			j = i;
			i = string.find(name, "[/\\]", i+1);
		}
		if (j) {
			name = string.sub(name, 0, j);
			zc.message(format("Adding path '%s'", name));
			zc.add_path(name);
		}
	}

	// store command line options
	zc.option_args = arg;
	zc.option_argind = 1;

	// parse options
	var filename = { };
	while (zc.option_argind <= #zc.option_args) {
		var arg = zc.option_getarg();

		if (string.sub(arg, 1, 1) == "-") {
			var opt = zc.options[arg];
			if (opt) {
				if (opt.call)
					opt.call();
	
				if (opt.postcall)
					zc.add_postprocess(opt.postcall);
			} else {
				zc.emiterror(format("Unknown option '%s'\n", arg));
				zc.option_help();
			}
		} else
			table.insert(filename, arg);
	}

	var function doit(filename) {
	    zc.zc(filename);
	}
	if (!next(filename))
		doit();
	else
		for (_, v in pairs(filename))
			doit(v);

	zc.do_postprocess();

	if (zc.has_error)
		os.exit(-1);
  
	//os.exit()
}

