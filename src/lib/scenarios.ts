import type { Scenario } from './types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'stop-times-index',
    title: 'Index on stop_times',
    description:
      'stop_times is the largest table in any GTFS feed. Without an index, ' +
      'looking up all stops for a single trip requires scanning every row.',
    slow: {
      label: 'Full table scan — no index',
      sql: `-- No index: SQLite scans all rows in stop_times to find matching trip_id
SELECT stop_id, arrival_time, departure_time, stop_sequence
FROM stop_times
WHERE trip_id = (SELECT trip_id FROM trips LIMIT 1 OFFSET 500)
ORDER BY stop_sequence`,
    },
    fast: {
      label: 'Index seek — trip_id indexed',
      sql: `-- Same query — the index makes SQLite jump directly to matching rows
SELECT stop_id, arrival_time, departure_time, stop_sequence
FROM stop_times
WHERE trip_id = (SELECT trip_id FROM trips LIMIT 1 OFFSET 500)
ORDER BY stop_sequence`,
    },
    setup: async (db) => {
      await db.query('CREATE INDEX IF NOT EXISTS idx_st_trip ON stop_times(trip_id)');
    },
    insight:
      'Adding an index on stop_times(trip_id) reduces a ~14M-row scan to a direct ' +
      'lookup — typically 400× faster on large feeds.',
  },
  {
    id: 'filter-before-join',
    title: 'Reduce rows before joining',
    description:
      'To count stop_times per route, the naive query joins the full 14M-row stop_times ' +
      'table to trips before aggregating. Pre-aggregating stop_times by trip first ' +
      'shrinks the intermediate result from millions of rows to one row per trip ' +
      'before any join happens.',
    slow: {
      label: 'Join 14M rows, then aggregate',
      sql: `-- Slow: joins stop_times (14M rows) to trips before grouping.
-- SQLite must carry all 14M rows through the join, then aggregate.
SELECT t.route_id, COUNT(*) AS stop_time_count
FROM stop_times st
JOIN trips t ON st.trip_id = t.trip_id
GROUP BY t.route_id
ORDER BY stop_time_count DESC
LIMIT 15`,
    },
    fast: {
      label: 'Aggregate first, then join the small result',
      sql: `-- Fast: aggregate stop_times alone first (14M → ~one row per trip).
-- The join then works on a compact result set, not raw stop_times.
WITH per_trip AS (
  SELECT trip_id, COUNT(*) AS n
  FROM stop_times
  GROUP BY trip_id
)
SELECT t.route_id, SUM(per_trip.n) AS stop_time_count
FROM per_trip
JOIN trips t ON t.trip_id = per_trip.trip_id
GROUP BY t.route_id
ORDER BY stop_time_count DESC
LIMIT 15`,
    },
    insight:
      'Pre-aggregating stop_times by trip_id reduces ~14M rows to ~one row per trip ' +
      'before the join. SQLite then needs ~100K trips lookups instead of 14M, ' +
      'dramatically reducing join overhead without any index required.',
  },
  {
    id: 'spatial-bounding-box',
    title: 'Nearest stops — bounding box',
    description:
      'Finding the closest stops to a point requires computing distance for every stop. ' +
      'A bounding box pre-filter cuts the candidate set before any math runs.',
    slow: {
      label: 'Distance computed for every stop',
      sql: `-- Slow: picks a reference stop from the feed, then computes
-- squared distance for ALL stops and sorts the full result.
WITH ref AS (
  SELECT CAST(stop_lat AS REAL) AS lat, CAST(stop_lon AS REAL) AS lon
  FROM stops WHERE stop_lat != '' AND stop_lon != ''
  LIMIT 1 OFFSET 500
)
SELECT s.stop_id, s.stop_name,
  ROUND(CAST(s.stop_lat AS REAL), 5) AS lat,
  ROUND(CAST(s.stop_lon AS REAL), 5) AS lon,
  ROUND(
    (CAST(s.stop_lat AS REAL) - ref.lat) * (CAST(s.stop_lat AS REAL) - ref.lat) +
    (CAST(s.stop_lon AS REAL) - ref.lon) * (CAST(s.stop_lon AS REAL) - ref.lon),
  6) AS dist_sq
FROM stops s, ref
WHERE s.stop_lat != '' AND s.stop_lon != ''
ORDER BY dist_sq
LIMIT 10`,
    },
    fast: {
      label: 'Bounding box first, then distance',
      sql: `-- Fast: same reference stop, but a cheap BETWEEN check on lat/lon
-- discards ~99% of stops before any distance math runs.
WITH ref AS (
  SELECT CAST(stop_lat AS REAL) AS lat, CAST(stop_lon AS REAL) AS lon
  FROM stops WHERE stop_lat != '' AND stop_lon != ''
  LIMIT 1 OFFSET 500
)
SELECT s.stop_id, s.stop_name,
  ROUND(CAST(s.stop_lat AS REAL), 5) AS lat,
  ROUND(CAST(s.stop_lon AS REAL), 5) AS lon,
  ROUND(
    (CAST(s.stop_lat AS REAL) - ref.lat) * (CAST(s.stop_lat AS REAL) - ref.lat) +
    (CAST(s.stop_lon AS REAL) - ref.lon) * (CAST(s.stop_lon AS REAL) - ref.lon),
  6) AS dist_sq
FROM stops s, ref
WHERE s.stop_lat != '' AND s.stop_lon != ''
  AND CAST(s.stop_lat AS REAL) BETWEEN ref.lat - 0.05 AND ref.lat + 0.05
  AND CAST(s.stop_lon AS REAL) BETWEEN ref.lon - 0.05 AND ref.lon + 0.05
ORDER BY dist_sq
LIMIT 10`,
    },
    insight:
      'The ±0.05° bounding box (≈5 km) is a cheap range check that cuts the candidate ' +
      'set from every stop in the feed to ~50–500 nearby stops before any ' +
      'floating-point distance math or sorting runs.',
  },
  {
    id: 'calendar-service',
    title: 'Is this service running today?',
    description:
      'GTFS splits service schedules across two tables: calendar (weekly pattern) and ' +
      'calendar_dates (exceptions). Resolving both correctly requires careful query design.',
    slow: {
      label: 'Scan trips and check both tables inline',
      sql: `-- Slow: correlated subqueries re-scan calendar tables for every trip
SELECT t.trip_id, t.trip_headsign, r.route_short_name
FROM trips t
JOIN routes r ON t.route_id = r.route_id
WHERE (
  SELECT COUNT(*) FROM calendar c
  WHERE c.service_id = t.service_id
    AND c.monday = '1'
    AND c.start_date <= '20240101'
    AND c.end_date   >= '20240101'
) > 0
  OR (
  SELECT COUNT(*) FROM calendar_dates cd
  WHERE cd.service_id  = t.service_id
    AND cd.date         = '20240101'
    AND cd.exception_type = '1'
)
LIMIT 20`,
    },
    fast: {
      label: 'Resolve active services first, then join trips',
      sql: `-- Fast: materialise active service_ids once, then join
WITH active_services AS (
  SELECT service_id FROM calendar
  WHERE monday = '1'
    AND start_date <= '20240101'
    AND end_date   >= '20240101'
  UNION
  SELECT service_id FROM calendar_dates
  WHERE date = '20240101' AND exception_type = '1'
  EXCEPT
  SELECT service_id FROM calendar_dates
  WHERE date = '20240101' AND exception_type = '2'
)
SELECT t.trip_id, t.trip_headsign, r.route_short_name
FROM trips t
JOIN routes r ON t.route_id = r.route_id
WHERE t.service_id IN (SELECT service_id FROM active_services)
LIMIT 20`,
    },
    insight:
      'The CTE resolves all active services once. The correlated-subquery version ' +
      're-evaluates both calendar tables for every single trip row.',
  },
];
