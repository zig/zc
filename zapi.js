
class_kind.zapi_write_pre = function(ns) {
    setoutput("zapi");
    outfi("class %s {\n", ns.name);
    outindent(1);
}

class_kind.zapi_write_post = function(ns) {
    outindent(-1);
    outfi("}\n");
}

var_kind.zapi_write = function(v) {
    outfi("");
    for (m, _ in pairs(v.mods))
	outf("%s ", m);
    outf("%s %s;\n", v.type.name, v.name);
}

func_kind.zapi_write = function(f, stage) {
    outfi("");
    for (m, _ in pairs(f.mods))
	outf("%s ", m);
    outf("%s %s", f.type.name, f.name);
    out("(");
    for (i, v in ipairs(f.params)) {
	if (!f.is_method || i > 1) {
	    outfi("%s %s", v.type.name, v.name);
	    if (i < #f.params)
		out(", ");
	}
    }
    out(");\n");
}

;
