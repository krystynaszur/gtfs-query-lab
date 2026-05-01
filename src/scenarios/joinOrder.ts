import type { Scenario } from '../lib/types';

function fmtRows(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export const joinOrder: Scenario = {
  id: 'filter-before-join',
  title: 'Count trips per route — aggregate before joining',
  description: (t) => {
    const tr = fmtRows(t['trips'] ?? 0);
    const ro = fmtRows(t['routes'] ?? 0);
    return (
      `A network dashboard needs to rank routes by how many trips they run. ` +
      `A correlated subquery answers that by re-scanning all ${tr} trips once for each of ${ro} routes. ` +
      `Aggregating trips into a CTE first and then joining the compact ${ro}-row summary does the same work in a single pass.`
    );
  },
  before: async (db) => {
    await db.query('DROP INDEX IF EXISTS idx_st_trip');
  },
  slow: {
    label: 'Correlated subquery — re-scans trips per route',
    sql: (t) => `-- Slow: for each of ${fmtRows(t['routes'] ?? 0)} routes, SQLite runs a full
-- scan of ${fmtRows(t['trips'] ?? 0)} trips. Look for the purple SUBQUERY node
-- wrapping a red SCAN — that scan executes once per outer row.
SELECT routes.route_short_name,
  (SELECT COUNT(*) FROM trips
   WHERE trips.route_id = routes.route_id) AS trip_count
FROM routes
ORDER BY trip_count DESC
LIMIT 15`,
  },
  fast: {
    label: 'CTE: aggregate trips once, join the summary',
    sql: (t) => `-- Fast: trips scanned exactly once into the CTE.
-- That single pass replaces ${fmtRows(t['routes'] ?? 0)} repeated scans
-- of ${fmtRows(t['trips'] ?? 0)} trips.
WITH counts AS (
  SELECT route_id, COUNT(*) AS trip_count
  FROM trips
  GROUP BY route_id
)
SELECT routes.route_short_name, counts.trip_count
FROM counts
JOIN routes ON routes.route_id = counts.route_id
ORDER BY counts.trip_count DESC
LIMIT 15`,
  },
  insight: (t) => {
    const tr = fmtRows(t['trips'] ?? 0);
    const ro = fmtRows(t['routes'] ?? 0);
    return (
      `The correlated subquery re-scans ${tr} trips for each of ${ro} routes — ${ro} full scans in total. ` +
      `The CTE runs that scan once and materialises ${ro} aggregated rows. ` +
      `In the plan, a red SCAN nested inside a correlated SUBQUERY becomes a single blue CTE badge — ` +
      `same result, a fraction of the reads.`
    );
  },
};
