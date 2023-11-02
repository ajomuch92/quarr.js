export function isObject(object: unknown): Boolean {
    return !!object && typeof object == 'object' && object.constructor == Object
}

export function isEmpty(val: unknown): Boolean {
    if (val === undefined || val === undefined) return true;
    else if (typeof val === 'string' && val.length === 0) return true;
    else if (Array.isArray(val) && val.length === 0) return true;
    else if (isObject(val) && Object.keys(val as Object).length === 0) return true;
    return false;
}

export function clone(val: unknown): Record<string, unknown> | number | string | Date | boolean | unknown {
    if (isObject(val)) {
        const cloning = {} as Record<string, unknown>;
        const objCopy = val as Record<string, unknown> ;
        Object.keys(objCopy).map((prop) => {
          const obj = objCopy[prop];
          if(obj === null) {
            cloning[prop] = null;
          } else if(obj === undefined) {
            cloning[prop] = undefined;
          } else if(Array.isArray(obj)) {
            const arr = [];
            for(const o of obj) {
              arr.push(clone(o));
            }
            cloning[prop] = arr;
          } else if(isObject(obj)) {
            cloning[prop] = clone(obj);
          } else if (obj instanceof Date) {
            cloning[prop] = new Date(obj.getTime());
          } else if (typeof obj === 'function') {
            cloning[prop] = obj.bind(obj);
          } else cloning[prop] = obj;
        });
        return cloning;
      } else if (val instanceof Date) {
        return new Date(val.getTime());
      } else {
        return val;
      }
}