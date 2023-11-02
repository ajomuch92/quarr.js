import { clone } from "./utils";

export default class Quarr<T> {
    declare private copyArr: Array<T>
    declare originalArr: Array<T>

    constructor(arr: Array<T>) {
        this.originalArr = arr;
        this.copyArr = arr.map((r) => clone(r) as T);
    }

    first(): T {
        return this.originalArr[0];
    }

    last(): T {
        return this.originalArr[this.originalArr.length - 1]
    }

    sortBy (field?: string): T[] {
        return this.originalArr.sort((a: T, b: T) => {
            if (field) {
                if (a[field] === b[field]) {
                  return 0;
                }
                return a[field] < b[field] ? -1 : 1;
              } else {
                if (a === b) {
                  return 0;
                }
                return a < b ? -1 : 1;
              }
        })
    }
}