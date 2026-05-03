import { useState, useEffect } from 'react';
import { useDB } from '../contexts/DBContext';
import { runQuery } from '../lib/queryRunner';

interface CheckDef {
  id: string;
  category: string;
  label: string;
  sql: string;
  severity: 'error' | 'warning';
  passLabel: string;
  failLabel: (n: number) => string;
}

type CheckStatus = 'running' | 'pass' | 'warning' | 'error' | 'skipped';

interface CheckResult {
  def: CheckDef;
  status: CheckStatus;
  count: number;
}

const CHECKS: CheckDef[] = [
  {
    id: 'expired_services',
    category: 'Services',
    label: 'Expired service periods',
    sql: `SELECT COUNT(*) FROM calendar WHERE end_date < strftime('%Y%m%d', 'now')`,
    severity: 'error',
    passLabel: 'No expired service periods',
    failLabel: (n) => `${n} expired service period${n !== 1 ? 's' : ''}`,
  },
  {
    id: 'expiring_soon',
    category: 'Services',
    label: 'Services expiring within 30 days',
    sql: `SELECT COUNT(*) FROM calendar WHERE end_date BETWEEN strftime('%Y%m%d', 'now') AND strftime('%Y%m%d', 'now', '+30 days')`,
    severity: 'warning',
    passLabel: 'No services expiring within 30 days',
    failLabel: (n) => `${n} service period${n !== 1 ? 's' : ''} expiring within 30 days`,
  },
  {
    id: 'routes_no_trips',
    category: 'Routes & Trips',
    label: 'Routes without trips',
    sql: `SELECT COUNT(*) FROM routes WHERE route_id NOT IN (SELECT DISTINCT route_id FROM trips)`,
    severity: 'warning',
    passLabel: 'All routes have at least one trip',
    failLabel: (n) => `${n} route${n !== 1 ? 's' : ''} with no trips`,
  },
  {
    id: 'trips_no_stoptimes',
    category: 'Routes & Trips',
    label: 'Trips without stop times',
    sql: `SELECT COUNT(*) FROM trips WHERE trip_id NOT IN (SELECT DISTINCT trip_id FROM stop_times)`,
    severity: 'error',
    passLabel: 'All trips have stop times',
    failLabel: (n) => `${n} trip${n !== 1 ? 's' : ''} with no stop times`,
  },
  {
    id: 'stops_no_coords',
    category: 'Stops',
    label: 'Stops missing coordinates',
    sql: `SELECT COUNT(*) FROM stops WHERE stop_lat = '' OR stop_lon = '' OR stop_lat IS NULL OR stop_lon IS NULL`,
    severity: 'error',
    passLabel: 'All stops have coordinates',
    failLabel: (n) => `${n} stop${n !== 1 ? 's' : ''} missing lat/lon`,
  },
  {
    id: 'stoptimes_bad_stop',
    category: 'Referential Integrity',
    label: 'Stop times → unknown stops',
    sql: `SELECT COUNT(*) FROM stop_times st LEFT JOIN stops s ON st.stop_id = s.stop_id WHERE s.stop_id IS NULL`,
    severity: 'error',
    passLabel: 'All stop_times.stop_id values exist in stops',
    failLabel: (n) => `${n} stop time${n !== 1 ? 's' : ''} reference unknown stops`,
  },
  {
    id: 'stoptimes_bad_trip',
    category: 'Referential Integrity',
    label: 'Stop times → unknown trips',
    sql: `SELECT COUNT(*) FROM stop_times st LEFT JOIN trips t ON st.trip_id = t.trip_id WHERE t.trip_id IS NULL`,
    severity: 'error',
    passLabel: 'All stop_times.trip_id values exist in trips',
    failLabel: (n) => `${n} stop time${n !== 1 ? 's' : ''} reference unknown trips`,
  },
  {
    id: 'trips_bad_route',
    category: 'Referential Integrity',
    label: 'Trips → unknown routes',
    sql: `SELECT COUNT(*) FROM trips t LEFT JOIN routes r ON t.route_id = r.route_id WHERE r.route_id IS NULL`,
    severity: 'error',
    passLabel: 'All trips.route_id values exist in routes',
    failLabel: (n) => `${n} trip${n !== 1 ? 's' : ''} reference unknown routes`,
  },
];

const CATEGORIES = [...new Set(CHECKS.map((c) => c.category))];

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'running') {
    return (
      <svg className="w-5 h-5 text-[var(--color-text-muted)] animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    );
  }
  if (status === 'pass') {
    return (
      <svg className="w-5 h-5 text-[var(--color-brand)] shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8" />
        <polyline points="7 10 9 12 13 8" />
      </svg>
    );
  }
  if (status === 'warning') {
    return (
      <svg className="w-5 h-5 text-[var(--color-amber)] shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.13 3.5L2 16h16L10.87 3.5a1 1 0 00-1.74 0z" />
        <line x1="10" y1="9" x2="10" y2="12" />
        <circle cx="10" cy="14.5" r="0.5" fill="currentColor" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg className="w-5 h-5 text-red-500 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8" />
        <line x1="7" y1="7" x2="13" y2="13" />
        <line x1="13" y1="7" x2="7" y2="13" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="10" x2="15" y2="10" />
    </svg>
  );
}

export function FeedValidator() {
  const { db } = useDB();
  const [results, setResults] = useState<CheckResult[]>(() =>
    CHECKS.map((def) => ({ def, status: 'running', count: 0 })),
  );

  useEffect(() => {
    if (!db) return;
    setResults(CHECKS.map((def) => ({ def, status: 'running', count: 0 })));

    async function runChecks() {
      for (const def of CHECKS) {
        let status: CheckStatus;
        let count = 0;
        try {
          const r = await runQuery(db!, def.sql);
          count = Number(r.results[0]?.values[0]?.[0] ?? 0);
          status = count === 0 ? 'pass' : def.severity;
        } catch {
          status = 'skipped';
        }
        setResults((prev) =>
          prev.map((r) => (r.def.id === def.id ? { def, status, count } : r)),
        );
      }
    }

    runChecks();
  }, [db]);

  const done = results.filter((r) => r.status !== 'running');
  const errors = done.filter((r) => r.status === 'error').length;
  const warnings = done.filter((r) => r.status === 'warning').length;
  const passed = done.filter((r) => r.status === 'pass').length;
  const allDone = done.length === CHECKS.length;

  return (
    <div className="flex flex-col gap-4">

      {/* Summary banner */}
      <div className={[
        'rounded-xl border px-5 py-4 flex items-center justify-between gap-4',
        !allDone
          ? 'bg-[var(--color-subtle)] border-[var(--color-border)]'
          : errors > 0
            ? 'bg-red-50 border-red-200'
            : warnings > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-[var(--color-brand-light)] border-[var(--color-brand-muted)]',
      ].join(' ')}>
        <div>
          <p className={[
            'text-base font-semibold',
            !allDone ? 'text-[var(--color-text-muted)]'
              : errors > 0 ? 'text-red-700'
              : warnings > 0 ? 'text-amber-700'
              : 'text-[var(--color-brand-dark)]',
          ].join(' ')} style={{ fontFamily: 'var(--font-display)' }}>
            {!allDone
              ? 'Running validation checks…'
              : errors > 0
                ? `${errors} error${errors !== 1 ? 's' : ''} found`
                : warnings > 0
                  ? 'Feed looks healthy — some warnings to review'
                  : 'All checks passed'}
          </p>
          {allDone && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {passed} passed · {warnings} warning{warnings !== 1 ? 's' : ''} · {errors} error{errors !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {allDone && errors === 0 && warnings === 0 && (
          <svg className="w-8 h-8 text-[var(--color-brand)] shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="8" />
            <polyline points="6 10 9 13 14 7" />
          </svg>
        )}
      </div>

      {/* Check groups */}
      {CATEGORIES.map((category) => {
        const categoryResults = results.filter((r) => r.def.category === category);
        return (
          <div key={category} className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-subtle)]">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {category}
              </h3>
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {categoryResults.map(({ def, status, count }) => (
                <li key={def.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="mt-0.5">
                    <StatusIcon status={status} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {def.label}
                    </p>
                    <p className={[
                      'text-sm mt-0.5',
                      status === 'running' ? 'text-[var(--color-text-muted)]'
                        : status === 'pass' ? 'text-[var(--color-text-muted)]'
                        : status === 'warning' ? 'text-amber-700'
                        : status === 'error' ? 'text-red-600'
                        : 'text-[var(--color-text-muted)]',
                    ].join(' ')}>
                      {status === 'running' && 'Checking…'}
                      {status === 'pass' && def.passLabel}
                      {(status === 'warning' || status === 'error') && def.failLabel(count)}
                      {status === 'skipped' && 'Table not present in this feed — skipped'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
