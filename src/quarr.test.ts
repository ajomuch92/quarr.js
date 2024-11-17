import { Quarr } from './index';

describe('Query', () => {
  const data = [
    { id: 1, name: 'Alice', age: 25, salary: 50000 },
    { id: 2, name: 'Bob', age: 30, salary: 60000 },
    { id: 3, name: 'Charlie', age: 35, salary: 70000 },
  ];

  it('should filter data using where', () => {
    const result = Quarr.from(data).where((item) => item.age > 25).execute();
    expect(result).toEqual([
      { id: 2, name: 'Bob', age: 30, salary: 60000 },
      { id: 3, name: 'Charlie', age: 35, salary: 70000 },
    ]);
  });

  it('should select specific fields', () => {
    const result = Quarr.from(data).select(['id', 'name']).execute();
    expect(result).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]);
  });

  it('should sort data by a field', () => {
    const result = Quarr.from(data).sort('name', 'desc').execute();
    expect(result).toEqual([
      { id: 3, name: 'Charlie', age: 35, salary: 70000 },
      { id: 2, name: 'Bob', age: 30, salary: 60000 },
      { id: 1, name: 'Alice', age: 25, salary: 50000 },
    ]);
  });

  it('should calculate sum of a numeric field', () => {
    const result = Quarr.from(data).sum('salary');
    expect(result).toBe(180000);
  });

  it('should calculate average of a numeric field', () => {
    const result = Quarr.from(data).avg('age');
    expect(result).toBe(30);
  });

  it('should join data with another dataset', () => {
    const otherData = [
      { userId: 1, country: 'USA' },
      { userId: 2, country: 'UK' },
      { userId: 3, country: 'Canada' },
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
    ]);
  });
});
