
#include <stdlib.h>
#include <stdint.h>
#include <limits.h>

#define zc_objref(obj) obj

#define zc_objunref(obj) obj


#define zc_setglobal(g, v) (g = (v))
#define zc_getglobal(g) g

#define zc_setmember(obj, field, v) ((obj)->field = v)
#define zc_getmember(obj, field) (obj)->field

#define zc_setlocal(l, v) (l = (v))
#define zc_getlocal(l) l

