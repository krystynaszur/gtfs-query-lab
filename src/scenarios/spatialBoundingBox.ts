import type { Scenario } from '../lib/types';

export const spatialBoundingBox: Scenario = {
  id: 'spatial-bounding-box',
  title: 'Find stops near a location — bounding box pre-filter',
  description:
    'A "nearest stops" feature needs to rank every stop in the feed by distance from the user\'s location. ' +
    'Without filtering, that means a full distance calculation for every stop. ' +
    'A cheap bounding box check on latitude and longitude discards far-away stops before any floating-point math runs.',
  slow: {
    label: 'Distance computed for every stop',
    sql: `-- Slow: picks a reference stop from the feed, then computes
-- squared distance for ALL stops and sorts the full result.
WITH ref AS (
  SELECT CAST(stop_lat AS REAL) AS lat, CAST(stop_lon AS REAL) AS lon
  FROM stops WHERE stop_lat != '' AND stop_lon != ''
  LIMIT 1 OFFSET 500
)
SELECT stops.stop_id, stops.stop_name,
  ROUND(CAST(stops.stop_lat AS REAL), 5) AS lat,
  ROUND(CAST(stops.stop_lon AS REAL), 5) AS lon,
  ROUND(
    (CAST(stops.stop_lat AS REAL) - ref.lat) * (CAST(stops.stop_lat AS REAL) - ref.lat) +
    (CAST(stops.stop_lon AS REAL) - ref.lon) * (CAST(stops.stop_lon AS REAL) - ref.lon),
  6) AS dist_sq
FROM stops, ref
WHERE stops.stop_lat != '' AND stops.stop_lon != ''
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
SELECT stops.stop_id, stops.stop_name,
  ROUND(CAST(stops.stop_lat AS REAL), 5) AS lat,
  ROUND(CAST(stops.stop_lon AS REAL), 5) AS lon,
  ROUND(
    (CAST(stops.stop_lat AS REAL) - ref.lat) * (CAST(stops.stop_lat AS REAL) - ref.lat) +
    (CAST(stops.stop_lon AS REAL) - ref.lon) * (CAST(stops.stop_lon AS REAL) - ref.lon),
  6) AS dist_sq
FROM stops, ref
WHERE stops.stop_lat != '' AND stops.stop_lon != ''
  AND CAST(stops.stop_lat AS REAL) BETWEEN ref.lat - 0.05 AND ref.lat + 0.05
  AND CAST(stops.stop_lon AS REAL) BETWEEN ref.lon - 0.05 AND ref.lon + 0.05
ORDER BY dist_sq
LIMIT 10`,
  },
  insight:
    'The ±0.05° bounding box (≈5 km) is a cheap range check that cuts the candidate ' +
    'set from every stop in the feed to ~50–500 nearby stops before any ' +
    'floating-point distance math or sorting runs.',
};
