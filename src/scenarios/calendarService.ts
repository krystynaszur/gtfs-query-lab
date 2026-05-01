import type { Scenario } from '../lib/types';

export const calendarService: Scenario = {
  id: 'calendar-service',
  title: 'Check which trips run today — materialise active services',
  description:
    'A real-time planner needs to know which trips actually operate on a given day, ' +
    'accounting for both the weekly schedule and any one-off exceptions. ' +
    'GTFS stores these across two tables: calendar for recurring patterns and calendar_dates for exceptions. ' +
    'Resolving both with correlated subqueries re-scans those tables for every trip; ' +
    'materialising the active service IDs once reduces that to a single lookup.',
  slow: {
    label: 'Scan trips and check both tables inline',
    sql: `-- Slow: correlated subqueries re-scan calendar tables for every trip
SELECT trips.trip_id, trips.trip_headsign, routes.route_short_name
FROM trips
JOIN routes ON trips.route_id = routes.route_id
WHERE (
  SELECT COUNT(*) FROM calendar
  WHERE calendar.service_id = trips.service_id
    AND calendar.monday = '1'
    AND calendar.start_date <= '20260101'
    AND calendar.end_date   >= '20260101'
) > 0
  OR (
  SELECT COUNT(*) FROM calendar_dates
  WHERE calendar_dates.service_id  = trips.service_id
    AND calendar_dates.date         = '20260101'
    AND calendar_dates.exception_type = '1'
)
LIMIT 20`,
  },
  fast: {
    label: 'Resolve active services first, then join trips',
    sql: `-- Fast: materialise active service_ids once, then join
WITH active_services AS (
  SELECT service_id FROM calendar
  WHERE monday = '1'
    AND start_date <= '20260101'
    AND end_date   >= '20260101'
  UNION
  SELECT service_id FROM calendar_dates
  WHERE date = '20260101' AND exception_type = '1'
  EXCEPT
  SELECT service_id FROM calendar_dates
  WHERE date = '20260101' AND exception_type = '2'
)
SELECT trips.trip_id, trips.trip_headsign, routes.route_short_name
FROM trips
JOIN routes ON trips.route_id = routes.route_id
WHERE trips.service_id IN (SELECT service_id FROM active_services)
LIMIT 20`,
  },
  insight:
    'The CTE resolves all active services once. The correlated-subquery version ' +
    're-evaluates both calendar tables for every single trip row.',
};
