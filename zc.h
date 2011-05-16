
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <limits.h>
#include <stdio.h>

typedef struct zc_obj_s zc_obj_t;

struct zc_obj_s {
  int refcount;
};


#define zc_toobj(ptr) (((zc_obj_t *) (ptr)) - 1)
#define zc_totype(type, obj) ((type *) (obj))

static inline zc_obj_t *_zc_objref(void *ptr, const char *file, const char *function, int line) 
{
  if (!ptr)
    return ptr;
  zc_obj_t *m = zc_toobj(ptr);
  //printf("%s %d: ref %d -> %d\n", function, line, m->refcount, m->refcount + 1);
  m->refcount++;
  return ptr;
}
#define zc_objref(type, obj) zc_totype(type, _zc_objref(obj, __FILE__, __FUNCTION__, __LINE__))

static inline zc_obj_t *_zc_objunref(void *ptr, void (*destructor)(void *), const char *file, const char *function, int line) 
{
  if (!ptr)
    return ptr;
  zc_obj_t *m = zc_toobj(ptr);
  //printf("%s %d: unref %d -> %d\n", function, line, m->refcount, m->refcount - 1);
  if ((--m->refcount) == 0) {
    destructor(ptr);
    free(m); 
  }
  return ptr;
}
#define zc_objunref(type, obj) zc_totype(type, _zc_objunref(obj, (void *) type##__destructor, __FILE__, __FUNCTION__, __LINE__))

inline zc_obj_t *_zc_objnew(size_t size)
{
  zc_obj_t *ptr = calloc(size + sizeof(zc_obj_t), 1); 
  ptr->refcount = 1; 
  return ptr;
}
#define zc_objnew(type) zc_totype(type, _zc_objnew(sizeof(type)) + 1)


#define zc_setglobal(g, v) (g = (v))
#define zc_getglobal(g) g

#define zc_setmember(obj, field, v) ((obj)->field = v)
#define zc_getmember(obj, field) (obj)->field

#define zc_setlocal(l, v) (l = (v))
#define zc_getlocal(l) l

