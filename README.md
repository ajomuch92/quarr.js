# Quarr: SQL-Like Query for Arrays

`quarr` is a lightweight TypeScript library that provides SQL-like operations for arrays of objects. Perform operations like `select`, `where`, `sort`, `join`, `sum`, and `avg` with ease, all while leveraging TypeScript's type safety.

## Features

- **SQL-like operations**: `select`, `where`, `sort`, `join`, `sum`, `avg`
- **Type-safe**: Ensures all operations respect the types of your data
- **Lightweight**: No heavy dependencies
- **Simple API**: Designed to be intuitive and easy to use

## Installation

Install the package using npm or yarn:

```bash
npm install quarr
```

or

```bash
yarn add quarr
```

## Usage

### Import the Library

```typescript
import { Query } from "quarr";
```

### Example: Basic Query

```typescript
const data = [
  { id: 1, name: "Alice", age: 25, salary: 50000 },
  { id: 2, name: "Bob", age: 30, salary: 60000 },
  { id: 3, name: "Charlie", age: 35, salary: 70000 },
];

// Select specific fields, filter, and sort
const result = Query.from(data)
  .select(["id", "name"])
  .where((item) => item.age > 25)
  .sort("name", "asc")
  .execute();

console.log(result);
// Output: [ { id: 2, name: 'Bob' }, { id: 3, name: 'Charlie' } ]
```

### Example: Join Operation

```typescript
const data = [
  { id: 1, name: "Alice", age: 25 },
  { id: 2, name: "Bob", age: 30 },
  { id: 3, name: "Charlie", age: 35 },
];

const otherData = [
  { userId: 1, country: "USA" },
  { userId: 2, country: "UK" },
  { userId: 3, country: "Canada" },
];

// Perform a join using 'id' and 'userId'
const result = Query.from(data)
  .join(otherData, "id", "userId", (item) => ({
    id: item.id,
    name: item.name,
    country: item.country,
  }))
  .execute();

console.log(result);
// Output: [
//   { id: 1, name: 'Alice', country: 'USA' },
//   { id: 2, name: 'Bob', country: 'UK' },
//   { id: 3, name: 'Charlie', country: 'Canada' }
// ]
```

### Example: Aggregation (`sum`, `avg`)

```typescript
const data = [
  { id: 1, name: "Alice", age: 25, salary: 50000 },
  { id: 2, name: "Bob", age: 30, salary: 60000 },
  { id: 3, name: "Charlie", age: 35, salary: 70000 },
];

// Calculate sum and average
const totalSalary = Query.from(data).sum("salary");
const averageAge = Query.from(data).avg("age");

console.log("Total Salary:", totalSalary); // 180000
console.log("Average Age:", averageAge); // 30
```

## API Reference

### `Query.from(data: T[])`

Creates a new query instance from an array of objects.

### `.select(fields: (keyof T)[])`

Selects specific fields from the objects.

### `.where(predicate: (item: T) => boolean)`

Filters the data based on a condition.

### `.sort(field: keyof T, order: 'asc' | 'desc' = 'asc')`

Sorts the data by a specific field in ascending or descending order.

### `.join<U, K extends keyof T, V extends keyof U>(other: U[], key1: K, key2: V, selectFields?: (item: T & U) => Partial<T & U>)`

Joins the current dataset with another based on matching keys.

### `.sum(field: keyof T)`

Calculates the sum of a numeric field.

### `.avg(field: keyof T)`

Calculates the average of a numeric field.

### `.execute()`

Executes the query and returns the resulting array.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request if you'd like to improve the library.

## License

This project is licensed under the MIT License.
