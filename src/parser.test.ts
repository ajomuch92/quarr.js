import { evalCondition, executeAST, parseSQL } from "../src/parser";

const sampleData = [
  { id: 1, name: "Alice", dept: "Cardiology", region: "East", cost: 500 },
  { id: 2, name: "Anna", dept: "Cardiology", region: "East", cost: 600 },
  { id: 3, name: "Bob", dept: "Neurology", region: "West", cost: 700 },
  { id: 4, name: "Ann", dept: "Cardiology", region: "East", cost: 400 },
  { id: 5, name: "Brian", dept: "Neurology", region: "East", cost: 800 },
];

describe("SQL Parser (quarr)", () => {
  /* ----------------------------- PARSE ----------------------------- */
  test("debería parsear un SELECT simple", () => {
    const ast = parseSQL("SELECT name, dept FROM ?");
    expect(ast.type).toBe("select");
    expect(ast.fields.length).toBe(2);
    expect(ast.fields[0].expr).toBe("name");
    expect(ast.from).toBe("?");
  });

  test("debería soportar alias con AS e implícitos", () => {
    const ast = parseSQL("SELECT dept AS area, region zona FROM ?");
    expect(ast.fields).toEqual([
      { expr: "dept", alias: "area" },
      { expr: "region", alias: "zona" },
    ]);
  });

  test("debería soportar WHERE con operadores", () => {
    const ast = parseSQL("SELECT * FROM ? WHERE cost >= 500 AND region = 'East'");
    expect(ast.where.op).toBe("AND");
    expect(ast.where.clauses[0]).toMatchObject({ left: "cost", op: ">=", right: 500 });
    expect(ast.where.clauses[1]).toMatchObject({ left: "region", op: "=", right: "East" });
  });

  test("debería parsear GROUP BY, ORDER BY y LIMIT", () => {
    const ast = parseSQL("SELECT dept, SUM(cost) AS total FROM ? GROUP BY dept ORDER BY total DESC LIMIT 10");
    expect(ast.groupBy).toEqual(["dept"]);
    expect(ast.orderBy).toEqual([{ field: "total", direction: "DESC" }]);
    expect(ast.limit).toBe(10);
  });

  /* --------------------------- CONDITIONS -------------------------- */
  test("evalCondition debería manejar operadores básicos", () => {
    const row = { cost: 500, region: "East" };
    expect(evalCondition(row, { left: "cost", op: ">", right: 300 })).toBe(true);
    expect(evalCondition(row, { left: "region", op: "=", right: "East" })).toBe(true);
    expect(evalCondition(row, { left: "cost", op: "<", right: 300 })).toBe(false);
  });

  test("evalCondition debería manejar LIKE (case-insensitive)", () => {
    const row = { name: "Alice" };
    expect(evalCondition(row, { left: "name", op: "LIKE", right: "A%" })).toBe(true);
    expect(evalCondition(row, { left: "name", op: "LIKE", right: "%ice" })).toBe(true);
    expect(evalCondition(row, { left: "name", op: "LIKE", right: "%xyz%" })).toBe(false);
  });

  /* ---------------------------- EXECUTION --------------------------- */
  test("executeAST debería ejecutar SELECT simple", () => {
    const ast = parseSQL("SELECT name, cost FROM ?");
    const res = executeAST(ast, sampleData);
    expect(res[0]).toHaveProperty("name");
    expect(res[0]).toHaveProperty("cost");
    expect(res.length).toBe(sampleData.length);
  });

  test("executeAST debería filtrar correctamente con WHERE", () => {
    const ast = parseSQL("SELECT name FROM ? WHERE region = 'West'");
    const res = executeAST(ast, sampleData);
    expect(res.length).toBe(1);
    expect(res[0].name).toBe("Bob");
  });

  test("executeAST debería soportar LIKE", () => {
    const ast = parseSQL("SELECT name FROM ? WHERE name LIKE 'A%'");
    const res = executeAST(ast, sampleData);
    const names = res.map(r => r.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Anna");
    expect(names).toContain("Ann");
    expect(names).not.toContain("Bob");
  });

  test("executeAST debería soportar GROUP BY con agregados", () => {
    const ast = parseSQL(`
      SELECT dept, COUNT(*) AS total, SUM(cost) AS sum, AVG(cost) AS avg, MAX(cost) AS max, MIN(cost) AS min
      FROM ?
      GROUP BY dept
      ORDER BY sum DESC
    `);
    const res = executeAST(ast, sampleData);
    const cardio = res.find(r => r.dept === "Cardiology");
    expect(cardio?.total).toBe(3);
    expect(cardio?.sum).toBe(1500);
    expect(cardio?.avg).toBe(500);
    expect(cardio?.max).toBe(600);
    expect(cardio?.min).toBe(400);
  });

  test("executeAST debería respetar LIMIT", () => {
    const ast = parseSQL("SELECT name FROM ? LIMIT 2");
    const res = executeAST(ast, sampleData);
    expect(res.length).toBe(2);
  });

  test("executeAST debería ordenar correctamente", () => {
    const ast = parseSQL("SELECT name, cost FROM ? ORDER BY cost DESC");
    const res = executeAST(ast, sampleData);
    expect(res[0].cost).toBeGreaterThanOrEqual(res[1].cost);
  });

  test("executeAST debería manejar WHERE con AND y OR combinados", () => {
    const ast = parseSQL("SELECT name FROM ? WHERE region = 'East' AND (name LIKE 'A%' OR cost > 700)");
    const res = executeAST(ast, sampleData);
    const names = res.map(r => r.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Anna");
    expect(names).toContain("Ann");
    expect(names).toContain("Brian"); // cost > 700
  });

  test("executeAST debería manejar COUNT global sin GROUP BY", () => {
    const ast = parseSQL("SELECT COUNT(*) AS total FROM ?");
    const res = executeAST(ast, sampleData);
    expect(res[0].total).toBe(sampleData.length);
  });
});
