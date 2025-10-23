# Quarr: SQL-Like Query for Arrays

`quarr` is a lightweight TypeScript library that brings SQL-like operations to arrays of objects. It allows you to perform operations such as `select`, `where`, `sort`, `join`, `sum`, `avg`, and `count`, all while maintaining TypeScript's type safety and performance.

## 🚀 Features

- **SQL-like operations**: `select`, `where`, `sort`, `join`, `sum`, `avg`, `count`
- **Smart indexing**: Joins and queries are optimized with internal indexing
- **Type-safe**: Ensures all operations are type-checked
- **Lightweight**: Zero dependencies
- **Simple API**: Familiar and expressive syntax

## 📦 Installation

```bash
npm install quarr.js
# or
yarn add quarr.js
```

## 💡 Usage

### Import the Library

```typescript
import { Quarr } from "quarr.js";
```

---

### 🧭 Example: Basic Query

```typescript
const data = [
  { id: 1, name: "Alice", age: 25, salary: 50000 },
  { id: 2, name: "Bob", age: 30, salary: 60000 },
  { id: 3, name: "Charlie", age: 35, salary: 70000 },
];

const result = Quarr.from(data)
  .select(["id", "name"])
  .where((item) => item.age > 25)
  .sort("name", "asc")
  .execute();

console.log(result);
// Output: [ { id: 2, name: 'Bob' }, { id: 3, name: 'Charlie' } ]
```

---

### 🔗 Example: Join Operation

```typescript
const users = [
  { id: 1, name: "Alice", age: 25 },
  { id: 2, name: "Bob", age: 30 },
  { id: 3, name: "Charlie", age: 35 },
];

const countries = [
  { userId: 1, country: "USA" },
  { userId: 2, country: "UK" },
  { userId: 3, country: "Canada" },
];

const result = Quarr.from(users)
  .join(countries, "id", "userId", (item) => ({
    id: item.id,
    name: item.name,
    country: item.country,
  }))
  .execute();

console.log(result);
// Output:
// [
//   { id: 1, name: 'Alice', country: 'USA' },
//   { id: 2, name: 'Bob', country: 'UK' },
//   { id: 3, name: 'Charlie', country: 'Canada' }
// ]
```

---

### 🧮 Example: Aggregation (`sum`, `avg`, `count`)

```typescript
const employees = [
  { id: 1, name: "Alice", age: 25, salary: 50000 },
  { id: 2, name: "Bob", age: 30, salary: 60000 },
  { id: 3, name: "Charlie", age: 35, salary: 70000 },
];

const totalSalary = Quarr.from(employees).sum("salary");
const averageAge = Quarr.from(employees).avg("age");
const count = Quarr.from(employees).count();

console.log("Total Salary:", totalSalary); // 180000
console.log("Average Age:", averageAge);   // 30
console.log("Total Count:", count);        // 3
```

---

### 🧠 Example: Validate Query Expression

```typescript
import { Quarr } from "quarr";

console.log(Quarr.isValidQuery("SELECT * FROM users WHERE age > 20")); // true
console.log(Quarr.isValidQuery("DROP TABLE users")); // false
```

---

### 🧠 Example: Parsing Query Expression

```typescript
import { Quarr } from "quarr";

const employees = [
  { id: 1, name: "Alice", age: 25, salary: 50000 },
  { id: 2, name: "Bob", age: 30, salary: 60000 },
  { id: 3, name: "Charlie", age: 35, salary: 70000 },
];

console.log(Quarr.fromQuery(employees, "SELECT * FROM employees WHERE age > 20"));
// Output:
// [
//   { id: 1, name: 'Alice', age: 25, salary: 50000 },
//   { id: 2, name: 'Bob', age: 30, salary: 60000 },
//   { id: 3, name: 'Charlie', age: 35, salary: 70000 }
// ]
```

---

## 🧩 API Reference

### `Quarr.from(data: T[])`
Creates a new query instance from an array of objects.

### `.select(fields: (keyof T)[])`
Selects specific fields.

### `.where(predicate: (item: T) => boolean)`
Filters the dataset using a custom condition.

### `.sort(field: keyof T, order: 'asc' | 'desc' = 'asc')`
Sorts the data by the specified field.

### `.join<U, K extends keyof T, V extends keyof U>(other: U[], key1: K, key2: V, selectFields?: (item: T & U) => Partial<T & U>)`
Performs an optimized join operation using indexed data.

### `.sum(field: keyof T)`
Returns the sum of a numeric field.

### `.avg(field: keyof T)`
Returns the average of a numeric field.

### `.count()`
Returns the number of elements in the dataset (supports chaining).

### `.execute()`
Executes the query chain and returns the resulting array.

### `isValidQuery(query: string)`
Validates if a query string matches the supported SQL-like syntax.

### `fromQuery<U extends Record<string, any>>(data: U[], query: string)`
Parses and executes a SQL-like query string on the provided data array.

---

## 🧑‍💻 Contributing

Contributions are welcome! Open an issue or submit a pull request to help improve Quarr.

---

## ⚖️ License

MIT License
