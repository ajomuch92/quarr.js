/**
 * sqlEngine.ts
 * - parseSQL(query): AST para SELECT (ya soporta AS, LIKE, AND/OR, GROUP BY, ORDER BY, LIMIT)
 * - evalCondition(row, cond): evalúa WHERE (incluye LIKE)
 * - executeAST(ast, data): ejecuta TODO el pipeline y soporta agregaciones:
 *     SUM(col), AVG(col), COUNT(* or col), MAX(col), MIN(col)
 *
 * No dependencias externas.
 */

export interface SQLSelectAST {
  type: "select";
  fields: { expr: string; alias?: string }[];
  from: string;
  where?: any;
  groupBy?: string[];
  orderBy?: { field: string; direction: "ASC" | "DESC" }[];
  limit?: number;
}

/* ---------------------------
   PARSER (same as before)
   --------------------------- */

export function parseSQL(query: string): SQLSelectAST {
  const clean = cleanQueryString(query.replace(/\s+/g, " "));
  const result: SQLSelectAST = { type: "select", fields: [], from: "" };

  const selectMatch = clean.match(/^SELECT (.+?) FROM /i);
  if (!selectMatch) throw new Error("Invalid query: missing SELECT or FROM");
  if (query.toLocaleLowerCase().includes('join')) throw new Error("Invalid query: JOIN not supported");

  const fieldsRaw = selectMatch[1].split(",").map((f) => f.trim());
  result.fields = fieldsRaw.map((f) => {
    const asMatch = f.match(/^(.+?)\s+(?:AS\s+)?([\w.]+)$/i);
    if (asMatch) {
      const [, expr, alias] = asMatch;
      return { expr: expr.trim(), alias: alias.trim() };
    }
    return { expr: f };
  });

  const fromMatch = clean.match(/FROM ([^\s]+)(?: |$)/i);
  if (!fromMatch) throw new Error("Invalid query: missing FROM");
  result.from = fromMatch[1];

  const whereMatch = clean.match(/WHERE (.+?)(GROUP BY|ORDER BY|LIMIT|$)/i);
  if (whereMatch) {
    const whereRaw = whereMatch[1].trim();
    result.where = parseWhere(whereRaw);
  }

  const groupMatch = clean.match(/GROUP BY (.+?)(ORDER BY|LIMIT|$)/i);
  if (groupMatch) {
    result.groupBy = groupMatch[1].split(",").map((s) => s.trim());
  }

  const orderMatch = clean.match(/ORDER BY (.+?)(LIMIT|$)/i);
  if (orderMatch) {
    const parts = orderMatch[1].split(",").map((p) => p.trim());
    result.orderBy = parts.map((p) => {
      const [field, dir] = p.split(" ");
      return { field, direction: (dir?.toUpperCase() as "ASC" | "DESC") || "ASC" };
    });
  }

  const limitMatch = clean.match(/LIMIT (\d+)/i);
  if (limitMatch) result.limit = parseInt(limitMatch[1], 10);

  return result;
}

function parseWhere(cond: string): any {
  cond = cond.trim();

  // Eliminar paréntesis exteriores si los hay
  if (cond.startsWith("(") && cond.endsWith(")")) {
    const inner = cond.slice(1, -1).trim();
    return parseWhere(inner);
  }

  // Buscar AND/OR a nivel superficial (no dentro de paréntesis)
  let depth = 0;
  let splitIndex = -1;
  let opFound = "";

  const upper = cond.toUpperCase();

  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0) {
      if (upper.startsWith(" AND ", i)) {
        splitIndex = i;
        opFound = "AND";
        break;
      }
      if (upper.startsWith(" OR ", i)) {
        splitIndex = i;
        opFound = "OR";
        break;
      }
    }
  }

  if (splitIndex !== -1) {
    const left = cond.slice(0, splitIndex).trim();
    const right = cond.slice(splitIndex + opFound.length + 1).trim();
    return { op: opFound, clauses: [parseWhere(left), parseWhere(right)] };
  }

  // Comparación simple (orden de operadores importante!)
  const comp = cond.match(/([\w.]+)\s*(>=|<=|!=|=|>|<|LIKE)\s*(['"]?)([^'"]+?)\3$/i);
  if (comp) {
    const [, left, operator, , rightRaw] = comp;
    const cleaned = rightRaw.trim();
    const num = Number(cleaned);
    const right = isNaN(num) ? cleaned : num;
    return { left, op: operator.toUpperCase(), right };
  }

  throw new Error("Unsupported WHERE clause: " + cond);
}


export function matchLike(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexStr = "^" + escaped.replace(/%/g, ".*").replace(/_/g, ".") + "$";
  return new RegExp(regexStr, "i").test(value);
}

export function evalCondition(row: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.op === "AND") return cond.clauses.every((c: any) => evalCondition(row, c));
  if (cond.op === "OR") return cond.clauses.some((c: any) => evalCondition(row, c));

  const val = row[cond.left];
  switch (cond.op) {
    case "=": return val == cond.right;
    case "!=": return val != cond.right;
    case ">": return val > cond.right;
    case "<": return val < cond.right;
    case ">=": return val >= cond.right;
    case "<=": return val <= cond.right;
    case "LIKE": return matchLike(String(val ?? ""), String(cond.right));
    default: throw new Error("Unsupported operator: " + cond.op);
  }
}

/* ---------------------------
   EXECUTION / AGGREGATES
   --------------------------- */

/**
 * Detecta si una expresión es una agregación y devuelve { fn, col } o null.
 * Soporta: SUM(col), AVG(col), COUNT(*|col), MAX(col), MIN(col)
 */
function parseAggregateExpr(expr: string): { fn: string; col: string | "*" } | null {
  const m = expr.match(/^\s*(SUM|AVG|COUNT|MAX|MIN)\s*\(\s*([\w.*]+)\s*\)\s*$/i);
  if (!m) return null;
  return { fn: m[1].toUpperCase(), col: m[2] };
}

/**
 * Evalúa una expresión simple (no agregada) sobre una fila.
 * Actualmente soporta solo columnas directas: "col" o "table.col"
 */
function evalSimpleExpr(row: any, expr: string) {
  const key = expr.trim();
  // If nested like a.b, try row[a][b]
  if (key.includes(".")) {
    const parts = key.split(".");
    let cur: any = row;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }
  return row[key];
}

/**
 * Calcula las agregaciones para un grupo de filas.
 */
function computeAggregatesForGroup(rows: any[], aggregates: { as: string; fn: string; col: string | "*" }[]) {
  const out: Record<string, any> = {};
  for (const ag of aggregates) {
    const fn = ag.fn;
    const col = ag.col;
    if (fn === "COUNT") {
      if (col === "*") out[ag.as] = rows.length;
      else out[ag.as] = rows.reduce((acc, r) => acc + (Number(evalSimpleExpr(r, col)) ? 1 : (evalSimpleExpr(r, col) != null ? 1 : 0)), 0);
      continue;
    }

    // collect numeric values if possible
    const vals = rows.map((r) => {
      const v = evalSimpleExpr(r, col);
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    }).filter((v) => v != null) as number[];

    if (fn === "SUM") out[ag.as] = vals.reduce((a, b) => a + b, 0);
    else if (fn === "AVG") out[ag.as] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    else if (fn === "MAX") out[ag.as] = vals.length ? Math.max(...vals) : null;
    else if (fn === "MIN") out[ag.as] = vals.length ? Math.min(...vals) : null;
    else out[ag.as] = null;
  }
  return out;
}

/**
 * Ejecuta el AST sobre un array de datos.
 * Retorna array de objetos ya con SELECT aplicado y aliases.
 */
export function executeAST(ast: SQLSelectAST, data: any[]): any[] {
  if (ast.type !== "select") throw new Error("Only SELECT supported");

  // 1) WHERE filtering
  const filtered = ast.where ? data.filter((r) => evalCondition(r, ast.where)) : data.slice();

  // 2) Detect fields: which are aggregates, which are simple selects
  const fields = ast.fields.map((f) => {
    const agg = parseAggregateExpr(f.expr);
    if (agg) {
      return { original: f.expr, alias: f.alias || f.expr, aggregate: true, fn: agg.fn, col: agg.col };
    } else {
      return { original: f.expr, alias: f.alias || f.expr, aggregate: false, col: f.expr.trim() };
    }
  });

  const aggregates = fields.filter((f) => f.aggregate) as { original: string; alias: string; aggregate: true; fn: string; col: string | "*" }[];

  // 3) GROUP BY handling
  if (ast.groupBy && ast.groupBy.length > 0) {
    // build groups map
    const groups = new Map<string, any[]>();
    const groupKeys = ast.groupBy.map((g) => g.trim());
    for (const row of filtered) {
      const keyParts = groupKeys.map((k) => {
        const v = evalSimpleExpr(row, k);
        return typeof v === "object" ? JSON.stringify(v) : String(v);
      });
      const key = keyParts.join("||");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    // for each group, compute aggregates and build result row
    const results: any[] = [];
    for (const [key, rows] of groups.entries()) {
      const resultRow: any = {};

      // add group-by fields (use value from first row)
      for (const gb of groupKeys) {
        resultRow[gb] = evalSimpleExpr(rows[0], gb);
      }

      // compute aggregates
      const aggResults = computeAggregatesForGroup(rows, aggregates.map(a => ({ as: a.alias, fn: a.fn, col: a.col })));
      Object.assign(resultRow, aggResults);

      // for non-aggregated selected columns that are not group keys:
      for (const f of fields.filter((x) => !x.aggregate)) {
        const col = f.col;
        // If it's a group key, already present as resultRow[col]; otherwise pick first row's value
        if (groupKeys.includes(col)) {
          // If alias differs, copy to alias
          if (f.alias && f.alias !== col) resultRow[f.alias] = resultRow[col];
        } else {
          resultRow[f.alias] = evalSimpleExpr(rows[0], col);
        }
      }

      results.push(resultRow);
    }

    // 4) ORDER BY (may refer to alias or field)
    let ordered = results;
    if (ast.orderBy && ast.orderBy.length) {
      ordered = orderRows(results, ast.orderBy);
    }

    // 5) LIMIT
    if (ast.limit != null) ordered = ordered.slice(0, ast.limit);

    return ordered;
  }

  // 4) No GROUP BY
  if (aggregates.length > 0) {
    // compute aggregates over entire filtered set and return a single row
    const aggResults = computeAggregatesForGroup(filtered, aggregates.map(a => ({ as: a.alias, fn: a.fn, col: a.col })));
    const resultRow: any = {};
    Object.assign(resultRow, aggResults);

    // If there are non-aggregated selected columns, convention: include first row's values (if any)
    for (const f of fields.filter((x) => !x.aggregate)) {
      resultRow[f.alias] = filtered.length ? evalSimpleExpr(filtered[0], f.col) : null;
    }

    // ORDER BY and LIMIT are not meaningful here (single row), but if ORDER BY refers to alias it is already present.
    return ast.limit != null ? [resultRow].slice(0, ast.limit) : [resultRow];
  }

  // 5) Simple SELECT without aggregates and without GROUP BY: project rows
  let projected = filtered.map((row) => {
    const out: any = {};
    for (const f of fields) {
      out[f.alias] = evalSimpleExpr(row, f.col);
    }
    return out;
  });

  // ORDER BY
  if (ast.orderBy && ast.orderBy.length) {
    projected = orderRows(projected, ast.orderBy);
  }

  // LIMIT
  if (ast.limit) projected = projected.slice(0, ast.limit);

  return projected;
}

/* ---------------------------
   HELPERS
   --------------------------- */

function orderRows(rows: any[], orderBy: { field: string; direction: "ASC" | "DESC" }[]) {
  // Support ordering by alias or field; compare numbers first, then strings
  const compare = (a: any, b: any, field: string) => {
    const va = a[field];
    const vb = b[field];
    if (va == null && vb == null) return 0;
    if (va == null) return -1;
    if (vb == null) return 1;
    const na = Number(va);
    const nb = Number(vb);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    const sa = String(va).toLowerCase();
    const sb = String(vb).toLowerCase();
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  };

  const rowsCopy = rows.slice();
  rowsCopy.sort((r1, r2) => {
    for (const ord of orderBy) {
      const field = ord.field;
      const dir = ord.direction === "DESC" ? -1 : 1;
      const cmp = compare(r1, r2, field);
      if (cmp !== 0) return cmp * dir;
    }
    return 0;
  });
  return rowsCopy;
}

function splitSelectFields(selectBody: string): string[] {
  const res: string[] = [];
  let cur = "";
  let depth = 0;
  for (let i = 0; i < selectBody.length; i++) {
    const ch = selectBody[i];
    if (ch === "(") {
      depth++;
      cur += ch;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
      cur += ch;
    } else if (ch === "," && depth === 0) {
      res.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) res.push(cur.trim());
  return res;
}

function cleanSelectField(field: string): string {
  // Mantener alias: detectar "AS alias" o "expr alias"
  // vamos a separar por AS primero (case-insensitive)
  let alias = "";
  let expr = field;
  const asMatch = field.match(/\s+AS\s+([A-Za-z0-9_]+)$/i);
  if (asMatch) {
    alias = asMatch[1];
    expr = field.slice(0, asMatch.index).trim();
  } else {
    // posible alias sin AS: "expr alias"
    const parts = field.split(/\s+/);
    if (parts.length > 1) {
      // si la última parte no contiene paréntesis ni operador, considerar alias
      const last = parts[parts.length - 1];
      if (!/[(),]/.test(last) && !/\w+\(.*\)/.test(last)) {
        alias = last;
        expr = parts.slice(0, -1).join(" ");
      }
    }
  }

  // Si la expr es una agregación (COUNT,SUM,AVG,MIN,MAX) la dejamos tal cual (solo normalizamos espacios)
  if (/^\s*(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(expr)) {
    const out = expr.trim();
    return alias ? `${out} AS ${alias}` : out;
  }

  // Limpiar cast y funciones de formato en expr
  let e = expr
    .replace(/\bCAST\s*\(\s*([^,)]+?)\s*(?:AS\s+)?[A-Z0-9_]+(?:\s*\([^)]*\))?\s*\)/gi, "$1")
    .replace(/\b(LOWER|UPPER|TRIM|LTRIM|RTRIM)\s*\(\s*([^)]+?)\s*\)/gi, "$2")
    .replace(/\bSUBSTRING\s*\(\s*([^)]+?)(?:\s+FROM[\s\S]*?|\s*,[\s\S]*?)\)/gi, "$1");

  // eliminar envolturas simples de identificador ( (col) -> col ), pero SOLO si no hay función
  e = e.replace(/^\(\s*\(\s*([A-Za-z0-9_.]+)\s*\)\s*\)$/, "$1"); // doble
  e = e.replace(/^\(\s*([A-Za-z0-9_.]+)\s*\)$/, "$1"); // simple

  // reconstruir con alias si existe
  return alias ? `${e.trim()} AS ${alias}` : e.trim();
}

export function cleanQueryString(query: string): string {
  if (!query) return "";

  let cleaned = query
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const m = cleaned.match(/^(SELECT\s+)(.+?)(\s+FROM\s+)([\s\S]*)$/i);
  if (!m) return cleaned.replace(/\s*;\s*$/, "").trim();

  const [, selectStart, selectBody, fromPart, rest] = m;

  const fields = splitSelectFields(selectBody);
  const cleanedFields = fields.map(cleanSelectField);
  const newSelect = cleanedFields.join(", ");

  const rebuilt = `${selectStart}${newSelect}${fromPart}${rest || ""}`
    .replace(/\s+/g, " ")
    .replace(/\s*;\s*$/, "")
    .trim();

  return rebuilt;
}
