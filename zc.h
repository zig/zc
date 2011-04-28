
#include <stdlib.h>
#include <stdint.h>
#include <limits.h>

typedef struct zc_obj_s zc_obj_t;

struct zc_obj_s {
  int refcount;
};


#define zc_objref(obj) (obj->__zc.refcount++, obj)
inline _zc_objunref(void *ptr, zc_obj_t *m) { if ((--m->refcount) == 0) free(ptr); }
#define zc_objunref(obj) (_zc_objunref(obj, &obj->zc), obj)


#define zc_setglobal(g, v) (g = (v))
#define zc_getglobal(g) g

#define zc_setmember(obj, field, v) ((obj)->field = v)
#define zc_getmember(obj, field) (obj)->field

#define zc_setlocal(l, v) (l = (v))
#define zc_getlocal(l) l

