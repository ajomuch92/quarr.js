# Quarr: SQL-Like Query for Arrays

`quarr` is a lightweight TypeScript library that brings SQL-like operations to arrays of objects.  
It now supports **aggregations**, **field aliases**, **advanced filtering**, and a built-in **SQL-like parser** — all with zero dependencies.

---

## 🚀 Features

- **SQL-like operations**: `SELECT`, `WHERE`, `ORDER BY`, `JOIN`, `SUM`, `AVG`, `COUNT`, `MIN`, `MAX`
- **Advanced filtering**: Supports `AND`, `OR`, parentheses, comparison operators (`=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`)
- **Aliases (`AS`)** for field renaming
- **Raw SQL-like parser** (`fromQuery`) for quick querying — *(no JOINs supported in raw mode)*
- **Type-safe and dependency-free**
- **Tested** with Jest

---

## 📦 Installation

```bash
npm install quarr.js
# or
yarn add quarr.js
```

---

## 💡 Usage

### Import

```ts
import { Quarr } from "quarr.js";
```

---

### 🧭 Example: Basic Query Builder

```ts
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
// → [ { id: 2, name: 'Bob' }, { id: 3, name: 'Charlie' } ]
```

---

### 🧮 Example: Aggregations (`SUM`, `AVG`, `MIN`, `MAX`, `COUNT`)

```ts
const employees = [
  { id: 1, name: "Alice", age: 25, salary: 50000 },
  { id: 2, name: "Bob", age: 30, salary: 60000 },
  { id: 3, name: "Charlie", age: 35, salary: 70000 },
];

console.log("Total Salary:", Quarr.from(employees).sum("salary")); // 180000
console.log("Average Age:", Quarr.from(employees).avg("age"));     // 30
console.log("Max Salary:", Quarr.from(employees).max("salary"));   // 70000
console.log("Min Salary:", Quarr.from(employees).min("salary"));   // 50000
console.log("Employee Count:", Quarr.from(employees).count());     // 3
```

---

### 🧩 Example: SQL-like Query (via Parser)

```ts
const employees = [
  { id: 1, name: "Alice", age: 25, salary: 50000 },
  { id: 2, name: "Bob", age: 30, salary: 60000 },
  { id: 3, name: "Charlie", age: 35, salary: 70000 },
];

// Basic SELECT
console.log(Quarr.fromQuery(employees, "SELECT id, name FROM employees WHERE age >= 30"));

// Using aliases and LIKE
console.log(Quarr.fromQuery(employees, "SELECT name AS employee, salary FROM employees WHERE name LIKE 'a'"));

// Using aggregation directly in query
console.log(Quarr.fromQuery(employees, "SELECT AVG(salary) AS average_salary FROM employees"));
```

**Output:**
```json
[ { "average_salary": 60000 } ]
```

🧠 *Note:* `fromQuery` (raw SQL-like parser) does **not** support `JOIN` statements.  
Use the programmatic API (`.join()`) for join operations.

---

### 🔗 Example: Join Operation (Programmatic)

```ts
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
// → [
//   { id: 1, name: 'Alice', country: 'USA' },
//   { id: 2, name: 'Bob', country: 'UK' },
//   { id: 3, name: 'Charlie', country: 'Canada' }
// ]
```

---

## 🧠 Supported Query Syntax

Quarr’s parser supports a subset of SQL syntax:

```sql
SELECT name AS employee, salary
FROM employees
WHERE age >= 30 AND salary > 50000
ORDER BY name ASC
```

### Supported Features
- `SELECT` with optional aliases (`AS`)
- `WHERE` with logical operators (`AND`, `OR`)
- `LIKE`, comparisons (`=`, `!=`, `>`, `<`, `>=`, `<=`)
- Parentheses for nested conditions
- Aggregations (`SUM`, `AVG`, `MIN`, `MAX`, `COUNT`)
- `ORDER BY`
- **No JOINs in raw query mode**

---

## ⚙️ API Reference

### `Quarr.from(data: T[])`
Creates a new query instance.

### `.select(fields: (keyof T)[])`
Selects specific fields.

### `.where(predicate: (item: T) => boolean)`
Filters records.

### `.sort(field: keyof T, order?: 'asc' | 'desc')`
Sorts data.

### `.join<U>(other: U[], key1: keyof T, key2: keyof U, select?: (item: T & U) => Partial<T & U>)`
Performs a join using indexes.

### `.sum(field: keyof T)`
Sum of numeric field.

### `.avg(field: keyof T)`
Average of numeric field.

### `.min(field: keyof T)`
Minimum of numeric field.

### `.max(field: keyof T)`
Maximum of numeric field.

### `.count()`
Number of records.

### `.execute()`
Executes and returns result.

### `Quarr.fromQuery<T>(data: T[], query: string)`
Parses and executes a SQL-like query string.

---

## ⚠️ Breaking Changes

- `isValidQuery` **has been removed**.
  Query validation now happens automatically within `fromQuery()`.
- Adding a method to clean query strings, which removes unsupported functions from SQL-like queries.

---

## 🧑‍💻 Contributing

Contributions are welcome!  
Open an issue or PR on GitHub to help improve `quarr`.

---

## ⚖️ License

MIT License
