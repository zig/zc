
namespace_kind.decl0_write_pre = function(ns) {
    
}

namespace_kind.write_inner = function(ns, stage) {
    for (i, k in pairs(ns.types))
	writestage(k, stage);
    for (i, k in pairs(ns.vars))
	writestage(k, stage);
}

class_kind.write_inner = namespace_kind.write_inner;


function writestage(ns, stage) {
    if (ns[stage.."_write_pre"])
	ns[stage.."_write_pre"](ns, stage);
    if (ns["write_inner"])
	ns["write_inner"](ns, stage);
    if (ns[stage.."_write_post"])
	ns[stage.."_write_post"](ns, stage);
}

function codegen() {

    for (_, stage in ipairs { "decl0", "decl1", "code0", "code1" }) {
	writestage(namespace, stage);
    }

}

dummy = nil;
