import { Quarr } from './index';

describe('Quarr', () => {
  const data = [
    { id: 1, name: 'Alice', age: 25, salary: 50000 },
    { id: 2, name: 'Bob', age: 30, salary: 60000 },
    { id: 3, name: 'Charlie', age: 35, salary: 70000 },
    { id: 4, name: 'David', age: 40, salary: 80000 },
  ];

  it('should filter data using where', () => {
    const result = Quarr.from(data).where((item) => item.age > 25).execute();
    expect(result).toEqual([
      { id: 2, name: 'Bob', age: 30, salary: 60000 },
      { id: 3, name: 'Charlie', age: 35, salary: 70000 },
      { id: 4, name: 'David', age: 40, salary: 80000 },
    ]);
  });

  it('should select specific fields', () => {
    const result = Quarr.from(data).select(['id', 'name']).execute();
    expect(result).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
      { id: 4, name: 'David' },
    ]);
  });

  it('should sort data by a field', () => {
    const result = Quarr.from(data).sort('name', 'desc').execute();
    expect(result).toEqual([
      { id: 4, name: 'David', age: 40, salary: 80000 },
      { id: 3, name: 'Charlie', age: 35, salary: 70000 },
      { id: 2, name: 'Bob', age: 30, salary: 60000 },
      { id: 1, name: 'Alice', age: 25, salary: 50000 },
    ]);
  });

  it('should limit the number of results', () => {
    const result = Quarr.from(data).limit(2).execute();
    expect(result).toEqual([
      { id: 1, name: 'Alice', age: 25, salary: 50000 },
      { id: 2, name: 'Bob', age: 30, salary: 60000 },
    ]);
  });

  it('should skip records using skip', () => {
    const result = Quarr.from(data).skip(2).execute();
    expect(result).toEqual([
      { id: 3, name: 'Charlie', age: 35, salary: 70000 },
      { id: 4, name: 'David', age: 40, salary: 80000 },
    ]);
  });

  it('should calculate sum of a numeric field', () => {
    const result = Quarr.from(data).sum('salary');
    expect(result).toBe(260000);
  });

  it('should calculate average of a numeric field', () => {
    const result = Quarr.from(data).avg('age');
    expect(result).toBe(32.5);
  });

  it('should calculate count of items', () => {
    const result = Quarr.from(data).count();
    expect(result).toBe(4);
  });

  it('should join data with another dataset', () => {
    const otherData = [
      { userId: 1, country: 'USA' },
      { userId: 2, country: 'UK' },
      { userId: 3, country: 'Canada' },
      { userId: 4, country: 'Germany' },
    ];

    const result = Quarr.from(data)
      .join(otherData, 'id', 'userId', (item) => ({
        id: item.id,
        name: item.name,
        country: item.country,
      }))
      .execute();

    expect(result).toEqual([
      { id: 1, name: 'Alice', country: 'USA' },
      { id: 2, name: 'Bob', country: 'UK' },
      { id: 3, name: 'Charlie', country: 'Canada' },
      { id: 4, name: 'David', country: 'Germany' },
    ]);
  });

  it('should execute SQL-like query with select, where, and order', () => {
    const query = 'SELECT name, salary FROM data WHERE age > 25 ORDER BY salary DESC LIMIT 2 OFFSET 0';
    const result = Quarr.fromQuery(data, query);

    expect(result).toEqual([
      { name: 'David', salary: 80000 },
      { name: 'Charlie', salary: 70000 },
    ]);
  });

  it('should calculate count from SQL-like query', () => {
    const query = 'SELECT COUNT(*) FROM data WHERE salary >= 60000';
    const result = Quarr.fromQuery(data, query);

    expect(result).toBe(3);
  });

  it('should calculate avg from SQL-like query', () => {
    const query = 'SELECT AVG(age) FROM data WHERE salary >= 60000';
    const result = Quarr.fromQuery(data, query);

    expect(result).toBe(35);
  });

  it('should calculate sum from SQL-like query', () => {
    const query = 'SELECT SUM(salary) FROM data WHERE age > 25';
    const result = Quarr.fromQuery(data, query);

    expect(result).toBe(210000);
  });

  it('should reject unsupported SQL expressions', () => {
    const invalidQueries = [
      'DELETE FROM data',
      'UPDATE data SET salary = 0',
      'SELECT * FROM data JOIN other',
    ];

    const mapInvalidQueries = invalidQueries.map((q) => Quarr.isValidQuery(q));
    expect(mapInvalidQueries).toEqual([false, false, false]);
  });

  it('should accept supported SQL expressions', () => {
    const validQueries = [
      'SELECT * FROM data',
      'SELECT name, age FROM data WHERE age > 25 ORDER BY age DESC LIMIT 5 OFFSET 2',
      'SELECT SUM(salary) FROM data',
      'SELECT COUNT(*) FROM data',
    ];

    const mapValidQueries = validQueries.map((q) => Quarr.isValidQuery(q));
    expect(mapValidQueries).toEqual([true, true, true, true]);
  });
});
