export type SortOrder = 'asc' | 'desc';

export class Quarr<T extends Record<string, any>> {
  private data: T[];
  private selectedFields?: (keyof T)[];
  private filters: ((item: T) => boolean)[] = [];
  private sortField?: keyof T;
  private sortOrder: SortOrder = 'asc';
  private skipCount = 0;
  private limitCount?: number;

  constructor(data: T[]) {
    if (!Array.isArray(data)) {
      throw new Error('Input data must be an array.');
    }

    if (!data.every((item) => typeof item === 'object' && !Array.isArray(item))) {
      throw new Error('All elements in the array must be objects.');
    }

    this.data = data;
  }

  static from<U extends Record<string, any>>(data: U[]): Quarr<U> {
    return new Quarr<U>(data);
  }

  select(fields: (keyof T)[]): this {
    this.selectedFields = fields;
    return this;
  }

  where(predicate: (item: T) => boolean): this {
    this.filters.push(predicate);
    return this;
  }

  sort(field: keyof T, order: SortOrder = 'asc'): this {
    this.sortField = field;
    this.sortOrder = order;
    return this;
  }

  skip(count: number): this {
    if (count < 0) throw new Error('Skip count must be non-negative.');
    this.skipCount = count;
    return this;
  }

  limit(count: number): this {
    if (count <= 0) throw new Error('Limit count must be greater than 0.');
    this.limitCount = count;
    return this;
  }

  sum(field: keyof T): number {
    if (typeof this.data[0]?.[field] !== 'number') {
      throw new Error(`Field "${String(field)}" must be numeric for sum operation.`);
    }

    return this.data.reduce((acc, item) => acc + (item[field] as number), 0);
  }

  avg(field: keyof T): number {
    if (typeof this.data[0]?.[field] !== 'number') {
      throw new Error(`Field "${String(field)}" must be numeric for avg operation.`);
    }

    return this.sum(field) / this.data.length;
  }

  join<U extends Record<string, any>, V>(
    other: U[],
    key1: keyof T,
    key2: keyof U,
    selectFields?: (item: T & U) => Partial<T & U>
  ): Quarr<T & U> {
    if (!Array.isArray(other) || !other.every((item) => typeof item === 'object')) {
      throw new Error('Join target must be an array of objects.');
    }
  
    const joinedData: (T & U)[] = [];
  
    this.data.forEach((item1) => {
      other.forEach((item2) => {
        if (item1[key1] === (item2[key2] as unknown)) {
          const combined = { ...item1, ...item2 } as T & U;
          joinedData.push(
            selectFields ? (selectFields(combined) as T & U) : combined
          );
        }
      });
    });
  
    return new Quarr<T & U>(joinedData);
  }
  

  execute(): Partial<T>[] {
    let result: any[] = [...this.data];

    // Apply filters
    if (this.filters.length) {
      result = result.filter((item) => this.filters.every((f) => f(item)));
    }

    // Apply sorting
    if (this.sortField) {
      result.sort((a, b) => {
        const valueA = a[this.sortField!] as unknown as string | number;
        const valueB = b[this.sortField!] as unknown as string | number;

        if (valueA < valueB) return this.sortOrder === 'asc' ? -1 : 1;
        if (valueA > valueB) return this.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply skip and limit (pagination)
    if (this.skipCount) {
      result = result.slice(this.skipCount);
    }

    if (this.limitCount) {
      result = result.slice(0, this.limitCount);
    }

    // Apply field selection
    if (this.selectedFields) {
      result = result.map((item) =>
        this.selectedFields!.reduce((acc, field) => {
          acc[field] = item[field];
          return acc;
        }, {} as Partial<T>)
      );
    }

    return result;
  }
}
