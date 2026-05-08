import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useDB } from '../contexts/DBContext';
import { runQuery } from '../lib/queryRunner';
import { IndexInspector } from './IndexInspector';

interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface Route {
  id: string;
  label: string;
}

function FitBounds({ stops }: { stops: Stop[] }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length === 0) return;
    if (stops.length === 1) {
      map.setView([stops[0].lat, stops[0].lon], 14);
      return;
    }
    const lats = stops.map((s) => s.lat);
    const lons = stops.map((s) => s.lon);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ],
      { padding: [40, 40], maxZoom: 15 },
    );
  }, [stops, map]);
  return null;
}

export function RouteMap() {
  const { db } = useDB();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const firstCenter = useRef<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [tripIdIndexExists, setTripIdIndexExists] = useState<boolean | null>(null);
  const [creatingIndex, setCreatingIndex] = useState(false);

  useEffect(() => {
    if (!db) return;
    runQuery(
      db,
      `SELECT route_id,
              COALESCE(NULLIF(route_short_name,''), route_long_name, route_id) AS label
       FROM routes ORDER BY label`,
    )
      .then((r) => {
        const parsed = (r.results[0]?.values ?? []).map((row) => ({
          id: String(row[0]),
          label: String(row[1]),
        }));
        parsed.sort((a, b) => {
          const na = parseInt(a.label, 10);
          const nb = parseInt(b.label, 10);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          if (!isNaN(na)) return -1;
          if (!isNaN(nb)) return 1;
          return a.label.localeCompare(b.label);
        });
        setRoutes(parsed);
      })
      .catch(() => {});
  }, [db]);

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const safeId = selectedRoute.replace(/'/g, "''");
    const sql = selectedRoute
      ? `SELECT DISTINCT s.stop_id,
                COALESCE(NULLIF(s.stop_name,''), s.stop_id),
                CAST(s.stop_lat AS REAL),
                CAST(s.stop_lon AS REAL)
         FROM stop_times st
         JOIN trips t ON st.trip_id = t.trip_id
         JOIN stops s ON st.stop_id = s.stop_id
         WHERE t.route_id = '${safeId}'
           AND s.stop_lat != '' AND s.stop_lon != ''`
      : `SELECT stop_id,
               COALESCE(NULLIF(stop_name,''), stop_id),
               CAST(stop_lat AS REAL),
               CAST(stop_lon AS REAL)
         FROM stops
         WHERE stop_lat != '' AND stop_lon != ''`;

    runQuery(db, sql)
      .then((r) => {
        const rows = r.results[0]?.values ?? [];
        const parsed: Stop[] = rows
          .map((row) => ({
            id: String(row[0]),
            name: String(row[1]),
            lat: Number(row[2]),
            lon: Number(row[3]),
          }))
          .filter(
            (s) =>
              Number.isFinite(s.lat) &&
              Number.isFinite(s.lon) &&
              (s.lat !== 0 || s.lon !== 0),
          );
        setStops(parsed);
        if (!firstCenter.current && parsed.length > 0) {
          firstCenter.current = [parsed[0].lat, parsed[0].lon];
          setMapReady(true);
        }
      })
      .catch(() => setStops([]))
      .finally(() => setLoading(false));
  }, [db, selectedRoute]);

  useEffect(() => {
    if (!db || !selectedRoute) { setTripIdIndexExists(null); return; }
    const check = () =>
      runQuery(
        db,
        `SELECT 1 FROM sqlite_master
         WHERE type='index' AND tbl_name='stop_times'
         AND (name='idx_st_trip' OR sql LIKE '%trip_id%')
         LIMIT 1`,
      )
        .then((r) => setTripIdIndexExists((r.results[0]?.values ?? []).length > 0))
        .catch(() => {});
    check();
    const id = setInterval(check, 1500);
    return () => clearInterval(id);
  }, [db, selectedRoute]);

  const handleCreateTripIndex = async () => {
    if (!db || creatingIndex) return;
    setCreatingIndex(true);
    await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_st_trip ON stop_times(trip_id)`);
    setCreatingIndex(false);
  };

  const routeLabel = routes.find((r) => r.id === selectedRoute)?.label;
  const isRouteFiltered = selectedRoute !== '';

  return (
    <div className="flex flex-col gap-3">

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label
            htmlFor="route-select"
            className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0"
          >
            Filter by route
          </label>
          <select
            id="route-select"
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-1.5 bg-white text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] min-w-[180px]"
          >
            <option value="">All stops</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <span className="text-sm text-[var(--color-text-muted)] flex items-center gap-1.5">
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Loading…
            </>
          ) : (
            <>
              {stops.length.toLocaleString()} stop{stops.length !== 1 ? 's' : ''}
              {routeLabel && (
                <span className="text-[var(--color-text-muted)]"> on {routeLabel}</span>
              )}
            </>
          )}
        </span>
      </div>

      {/* Index hint — shown between toolbar and map when a route is filtered and idx_st_trip is missing */}
      {isRouteFiltered && tripIdIndexExists === false && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <svg className="mt-0.5 shrink-0 w-4 h-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="flex-1 text-amber-800">
              This join scans <span className="font-mono text-xs">stop_times</span> on{' '}
              <span className="font-mono text-xs">trip_id</span> without an index — slow on large feeds.
            </p>
            <button
              onClick={handleCreateTripIndex}
              disabled={creatingIndex}
              className="w-full sm:w-auto shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creatingIndex ? 'Creating…' : 'Create idx_st_trip'}
            </button>
          </div>
        </div>
      )}

      {/* Map */}
      <div
        className="rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-sm bg-[var(--color-subtle)]"
        style={{ height: '520px' }}
      >
        {!mapReady ? (
          <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-muted)]">
            {loading ? 'Loading stops…' : 'No stop coordinates found in this feed'}
          </div>
        ) : (
          <MapContainer
            center={firstCenter.current!}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds stops={stops} />
            {stops.map((stop) => (
              <CircleMarker
                key={stop.id}
                center={[stop.lat, stop.lon]}
                radius={isRouteFiltered ? 7 : 5}
                pathOptions={{
                  color: '#12452B',
                  fillColor: '#30B566',
                  fillOpacity: 0.82,
                  weight: 1.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  {stop.name}
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--color-brand)]">OpenStreetMap</a> contributors.
      </p>

      {isRouteFiltered && <IndexInspector />}
    </div>
  );
}
