import { useState } from 'react';
import { useDB } from '../contexts/DBContext';
import { runQuery } from '../lib/queryRunner';
import type { QueryResult } from '../lib/gtfsLoader';
import { QueryEditor } from './QueryEditor';
import { ResultsPanel } from './ResultsPanel';

const DEFAULT_SQL = `SELECT route_short_name, COUNT(DISTINCT trip_id) AS trips
FROM routes
JOIN trips USING (route_id)
GROUP BY route_short_name
ORDER BY trips DESC
LIMIT 15`;

export function FreeQueryEditor() {
  const { db } = useDB();
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRun(sql: string) {
    if (!db) return;
    setLoading(true);
    const r = await runQuery(db, sql);
    setResult(r);
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <QueryEditor defaultValue={DEFAULT_SQL} onRun={handleRun} loading={loading} />
      <ResultsPanel result={result} loading={loading} />
    </div>
  );
}
