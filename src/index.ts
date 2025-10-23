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

  count(predicate?: (item: T) => boolean): number {
    return this.data.reduce(
      (acc, item) => acc + (predicate ? (predicate(item) ? 1 : 0) : 1),
      0
    );
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

  static fromQuery<U extends Record<string, any>>(data: U[], query: string): any {
    if (!Array.isArray(data)) {
      throw new Error('First argument must be an array of objects.');
    }

    if (!Quarr.isValidQuery(query)) {
      throw new Error('Invalid or unsupported SQL query.');
    }

    // Normalize spaces
    const normalized = query.trim().replace(/\s+/g, ' ');

    // --- 1️⃣ Detect aggregate function (SUM, AVG, MAX, COUNT)
    const aggMatch = normalized.match(/SELECT\s+(SUM|AVG|MAX|COUNT)\((\*|\w+)\)/i);
    const aggregateFn = aggMatch ? aggMatch[1].toUpperCase() : null;
    const aggregateField = aggMatch ? aggMatch[2] : null;

    // --- 2️⃣ Detect selected fields
    const fieldsMatch = normalized.match(/SELECT\s+(.+?)\s+FROM/i);
    if (!fieldsMatch) throw new Error('Invalid query: missing SELECT or FROM.');
    const fieldStr = fieldsMatch[1].trim();

    const fields =
      fieldStr === '*'
        ? null
        : fieldStr
            .split(',')
            .map((f) => f.trim())
            .filter((f) => !/\(|\)/.test(f)); // exclude aggregate functions

    // --- 3️⃣ Detect WHERE clause
    const whereMatch = normalized.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+OFFSET|$)/i);
    const whereClause = whereMatch ? whereMatch[1].trim() : null;

    // --- 4️⃣ Detect ORDER BY
    const orderMatch = normalized.match(/(?:ORDER|SORT)\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
    const orderField = orderMatch ? orderMatch[1] : null;
    const orderDirection = orderMatch
      ? (orderMatch[2]?.toLowerCase() as 'asc' | 'desc') ?? 'asc'
      : 'asc';

    // --- 5️⃣ Detect LIMIT and OFFSET
    const limitMatch = normalized.match(/LIMIT\s+(\d+)/i);
    const offsetMatch = normalized.match(/OFFSET\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1]) : undefined;
    const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;

    // --- 6️⃣ Create base Quarr instance
    let q = new Quarr<U>(data);

    // Apply WHERE
    if (whereClause) {
      const predicates = Quarr.parseWhere(whereClause);
      predicates.forEach((p) => (q = q.where(p)));
    }

    // Apply ORDER BY
    if (orderField) {
      q = q.sort(orderField as keyof U, orderDirection);
    }

    // Apply OFFSET / LIMIT
    if (offset) q = q.skip(offset);
    if (limit) q = q.limit(limit);

    // Apply SELECT (only if not aggregate)
    if (fields && !aggregateFn) q = q.select(fields as (keyof U)[]);

    // --- 7️⃣ Execute aggregate function if applicable
    if (aggregateFn) {
      const filteredData = q.execute();

      switch (aggregateFn) {
        case 'SUM':
          if (!aggregateField || aggregateField === '*')
            throw new Error('SUM requires a field name.');
          return filteredData.reduce(
            (acc, item) => acc + (Number(item[aggregateField]) || 0),
            0
          );

        case 'AVG':
          if (!aggregateField || aggregateField === '*')
            throw new Error('AVG requires a field name.');
          const numericValues = filteredData
            .map((item) => Number(item[aggregateField]))
            .filter((n) => !isNaN(n));
          return numericValues.length
            ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
            : 0;

        case 'MAX':
          if (!aggregateField || aggregateField === '*')
            throw new Error('MAX requires a field name.');
          return Math.max(
            ...(filteredData.map((i) => Number(i[aggregateField])) as number[])
          );

        case 'COUNT':
          return filteredData.reduce((acc) => acc + 1, 0);
      }
    }

    // --- 8️⃣ If no aggregate function, execute normally
    return q.execute();
  }

  /**
   * Parses a simple WHERE clause and returns a list of predicates.
   * Supports operators: =, !=, >, <, >=, <=
   * Example: "age > 30 AND name != 'Ana'"
   */
  private static parseWhere<U extends Record<string, any>>(
    clause: string
  ): ((item: U) => boolean)[] {
    // Split by AND (OR not supported to keep it simple)
    const conditions = clause.split(/\s+AND\s+/i).map((c) => c.trim());

    const predicates: ((item: U) => boolean)[] = [];

    for (const cond of conditions) {
      const match = cond.match(
        /^(\w+)\s*(=|!=|>|<|>=|<=)\s*('?[\w.\s-]+'?|\d+(\.\d+)?)$/
      );
      if (!match) continue;

      const [, field, operator, rawValue] = match;
      let value: any = rawValue.replace(/^'|'$/g, ''); // remove quotes
      if (!isNaN(Number(value))) value = Number(value); // convert numbers

      predicates.push((item: U) => {
        const fieldValue = item[field as keyof U];
        switch (operator) {
          case '=':
            return fieldValue === value;
          case '!=':
            return fieldValue !== value;
          case '>':
            return fieldValue > value;
          case '<':
            return fieldValue < value;
          case '>=':
            return fieldValue >= value;
          case '<=':
            return fieldValue <= value;
          default:
            return false;
        }
      });
    }

    return predicates;
  }

  static isValidQuery(query: string): boolean {
    if (typeof query !== 'string') return false;
    const normalized = query.trim().replace(/\s+/g, ' ').toUpperCase();

    // Rechazar comandos no permitidos rápido
    const forbidden = [
      'JOIN',
      'GROUP BY',
      'INSERT',
      'UPDATE',
      'DELETE',
      'HAVING',
      'UNION',
      'INTO',
      'VALUES',
    ];
    if (forbidden.some((kw) => normalized.includes(kw))) return false;

    // Campos permitidos: '*' | list de campos | FUNC(field) donde FUNC = SUM|AVG|MAX|COUNT
    // Estructura permitida:
    // SELECT <fields> FROM <table> [WHERE ...] [ORDER|SORT BY <field> [ASC|DESC]] [LIMIT n] [OFFSET n]
    const fieldPart = '(?:\\*|(?:\\w+\\s*(?:,\\s*\\w+)*))|(?:(SUM|AVG|MAX|COUNT)\\(\\s*(?:\\*|\\w+)\\s*\\))';
    const pattern = new RegExp(
      '^SELECT\\s+(' + fieldPart + ')\\s+FROM\\s+\\w+' +
        '(?:\\s+WHERE\\s+.+?)?' +
        '(?:\\s+(?:ORDER|SORT)\\s+BY\\s+\\w+(?:\\s+(?:ASC|DESC))?)?' +
        '(?:\\s+LIMIT\\s+\\d+)?' +
        '(?:\\s+OFFSET\\s+\\d+)?$',
      'i'
    );

    return pattern.test(query.trim());
  }

}
