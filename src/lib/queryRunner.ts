import type { DbHandle, QueryResult, SqlRow } from './gtfsLoader';

export type { QueryResult };

// ── Plan types ────────────────────────────────────────────────────────────────

export type PlanOperation =
  | 'SCAN'
  | 'SEARCH'
  | 'SORT'
  | 'MATERIALIZE'
  | 'SUBQUERY'
  | 'COMPOUND'
  | 'OTHER';

export interface PlanNode {
  id: number;
  parentId: number;
  detail: string;
  operation: PlanOperation;
  table?: string;
  index?: string;
  children: PlanNode[];
}

export interface QueryResultWithPlan extends QueryResult {
  plan: PlanNode[];
}

// ── Plan parser ───────────────────────────────────────────────────────────────

function parseDetail(detail: string): Pick<PlanNode, 'operation' | 'table' | 'index'> {
  // Handle both old ("SCAN TABLE foo") and new ("SCAN foo") SQLite formats
  let m: RegExpMatchArray | null;

  // SEARCH … USING [COVERING] INDEX name
  m = detail.match(/^SEARCH (?:TABLE )?(\w+).*USING (?:COVERING )?INDEX (\S+)/);
  if (m) return { operation: 'SEARCH', table: m[1], index: m[2] };

  // SEARCH … USING INTEGER PRIMARY KEY (rowid lookup)
  m = detail.match(/^SEARCH (?:TABLE )?(\w+).*USING INTEGER PRIMARY KEY/);
  if (m) return { operation: 'SEARCH', table: m[1], index: 'rowid' };

  // SEARCH (any other — e.g. USING AUTOMATIC INDEX)
  m = detail.match(/^SEARCH (?:TABLE )?(\w+)/);
  if (m) return { operation: 'SEARCH', table: m[1] };

  // SCAN TABLE foo / SCAN foo
  m = detail.match(/^SCAN (?:TABLE )?(\w+)/);
  if (m) return { operation: 'SCAN', table: m[1] };

  // MATERIALIZE or CO-ROUTINE: both are CTE pre-computation strategies in SQLite
  if (detail.startsWith('MATERIALIZE') || detail.startsWith('CO-ROUTINE')) {
    return { operation: 'MATERIALIZE' };
  }

  // Correlated scalar subquery (SQLite 3.39+ EXPLAIN format)
  if (detail.startsWith('CORRELATED')) return { operation: 'SUBQUERY' };

  // SCAN SUBQUERY
  if (detail.startsWith('SCAN SUBQUERY')) return { operation: 'SUBQUERY' };

  // USE TEMP B-TREE (sort / group by / distinct)
  if (detail.startsWith('USE TEMP B-TREE')) return { operation: 'SORT' };

  // COMPOUND QUERY / UNION
  if (detail.startsWith('COMPOUND') || detail.startsWith('UNION')) {
    return { operation: 'COMPOUND' };
  }

  return { operation: 'OTHER' };
}

function buildPlanTree(rows: SqlRow[]): PlanNode[] {
  const byId = new Map<number, PlanNode>();

  for (const row of rows) {
    const id = Number(row[0]);
    const parentId = Number(row[1]);
    const detail = String(row[3] ?? '');
    const node: PlanNode = {
      id,
      parentId,
      detail,
      ...parseDetail(detail),
      children: [],
    };
    byId.set(id, node);
  }

  const roots: PlanNode[] = [];
  for (const node of byId.values()) {
    const parent = byId.get(node.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function runQuery(handle: DbHandle, sql: string): Promise<QueryResult> {
  return handle.query(sql);
}

export async function runQueryWithPlan(
  handle: DbHandle,
  sql: string,
): Promise<QueryResultWithPlan> {
  // Run plan query and actual query; worker serialises them so order is safe
  const [planResult, result] = await Promise.all([
    handle.query(`EXPLAIN QUERY PLAN ${sql}`),
    handle.query(sql),
  ]);

  const plan = buildPlanTree(planResult.results[0]?.values ?? []);
  return { ...result, plan };
}
