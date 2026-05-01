import type { DbHandle, QueryResult } from './gtfsLoader';

export type { QueryResult };

export function runQuery(handle: DbHandle, sql: string): Promise<QueryResult> {
  return handle.query(sql);
}
