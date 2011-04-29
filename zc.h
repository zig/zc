
#include <stdlib.h>
#include <stdint.h>
#include <limits.h>
#include <stdio.h>

typedef struct zc_obj_s zc_obj_t;

struct zc_obj_s {
  int refcount;
};


static inline void *_zc_objref(zc_obj_t *m, const char *file, const char *function, int line) 
{ 
  /* if (m) */
  /*   printf("%s %d: ref %d\n", function, line, m->refcount); */
  if (m)
    m->refcount++;
  return m;
}
#define zc_objref(type, obj) ((type *) _zc_objref((zc_obj_t *) (obj), __FILE__, __FUNCTION__, __LINE__))
static inline void *_zc_objunref(zc_obj_t *m, const char *file, const char *function, int line) 
{ 
  /* if (m) */
  /*   printf("%s %d: unref %d\n", function, line, m->refcount); */
  if (m && (--m->refcount) == 0) 
    free(m); 
  return m;
}
#define zc_objunref(type, obj) ((type *) _zc_objunref((zc_obj_t *) (obj), __FILE__, __FUNCTION__, __LINE__))
inline void *_zc_objnew(size_t size) { zc_obj_t *ptr = calloc(size, 1); ptr->refcount = 1; return ptr; }
#define zc_objnew(type) (type *) _zc_objnew(sizeof(type))


#define zc_setglobal(g, v) (g = (v))
#define zc_getglobal(g) g

#define zc_setmember(obj, field, v) ((obj)->field = v)
#define zc_getmember(obj, field) (obj)->field

#define zc_setlocal(l, v) (l = (v))
#define zc_getlocal(l) l

