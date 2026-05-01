import type { Scenario } from '../lib/types';

function fmtRows(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export const stopTimesIndex: Scenario = {
  id: 'stop-times-index',
  title: 'Look up stops for a trip — index on stop_times',
  description: (t) => {
    const st = fmtRows(t['stop_times'] ?? 0);
    return (
      `A passenger app needs to show every stop on a selected trip — a query that hits stop_times, ` +
      `the largest table in any GTFS feed (${st} rows here). ` +
      `Without an index on trip_id, every lookup scans the whole table. ` +
      `One index on trip_id turns that full scan into a direct key seek.`
    );
  },
  before: async (db) => {
    await db.query('DROP INDEX IF EXISTS idx_st_trip');
  },
  slow: {
    label: 'Full table scan — no index on trip_id',
    sql: (t) => `-- Slow: no index on stop_times.trip_id
-- SQLite reads all ${fmtRows(t['stop_times'] ?? 0)} rows to find stops for one trip.
-- Watch for the red SCAN badge and the full-width scan bar below.
SELECT stop_id, arrival_time, departure_time, stop_sequence
FROM stop_times
WHERE trip_id = (SELECT trip_id FROM trips LIMIT 1 OFFSET 500)
ORDER BY stop_sequence`,
  },
  setup: async (db) => {
    await db.query('CREATE INDEX IF NOT EXISTS idx_st_trip ON stop_times(trip_id)');
  },
  fast: {
    label: 'Index seek — stop_times(trip_id) indexed',
    sql: (t) => `-- Fast: idx_st_trip covers stop_times(trip_id).
-- SQLite jumps directly to matching rows — skips all ${fmtRows(t['stop_times'] ?? 0)} others.
-- The red SCAN badge becomes a SEARCH badge; the scan bar disappears.
SELECT stop_id, arrival_time, departure_time, stop_sequence
FROM stop_times
WHERE trip_id = (SELECT trip_id FROM trips LIMIT 1 OFFSET 500)
ORDER BY stop_sequence`,
  },
  insight: (t) =>
    `Without an index, every query reads all ${fmtRows(t['stop_times'] ?? 0)} stop_times rows. ` +
    `The index on trip_id lets SQLite jump straight to matching rows — ` +
    `that single badge change from red SCAN to SEARCH typically means 100–500× fewer reads on a large feed.`,
};
