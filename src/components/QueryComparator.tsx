import { useState } from 'react';
import type { DbHandle } from '../lib/gtfsLoader';
import type { QueryResultWithPlan } from '../lib/queryRunner';
import { runQuery, runQueryWithPlan } from '../lib/queryRunner';
import { useDB } from '../contexts/DBContext';
import { ExecutionPlanPanel } from './ExecutionPlanPanel';
import { recordQuery } from '../lib/queryHistory';

interface Side {
  label: string;
  sql: string | ((tableSizes: Record<string, number>) => string);
}

function SqlBlock({ sql }: { sql: string }) {
  return (
    <pre className="text-xs font-mono whitespace-pre" style={{ color: 'var(--color-code-text)' }}>
      {sql.trim().split('\n').map((line, i) => (
        <span
          key={i}
          style={line.trimStart().startsWith('--') ? { color: 'var(--color-text-muted)' } : undefined}
        >
          {line}{'\n'}
        </span>
      ))}
    </pre>
  );
}

interface QueryComparatorProps {
  slow: Side;
  fast: Side;
  before?: (db: DbHandle) => Promise<void>;
  setup?: (db: DbHandle) => Promise<void>;
  insight?: string | ((tableSizes: Record<string, number>) => string);
}

type RunState = { slow: QueryResultWithPlan | null; fast: QueryResultWithPlan | null };

function SpeedupBadge({ slow, fast }: { slow: QueryResultWithPlan; fast: QueryResultWithPlan }) {
  if (slow.durationMs === 0 || fast.durationMs === 0) return null;
  const ratio = slow.durationMs / fast.durationMs;
  const faster = ratio >= 1;
  return (
    <div className={[
      'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium',
      faster
        ? 'bg-[var(--color-brand-light)] border-[var(--color-brand-muted)] text-[var(--color-brand-dark)]'
        : 'bg-red-50 border-red-200 text-red-600',
    ].join(' ')}>
      {faster
        ? `Fast query was ${ratio.toFixed(1)}× faster`
        : `Fast query was ${(1 / ratio).toFixed(1)}× slower — try a larger feed`}
    </div>
  );
}

export function QueryComparator({ slow, fast, before, setup, insight }: QueryComparatorProps) {
  const { db, tableSizes } = useDB();
  const [results, setResults] = useState<RunState>({ slow: null, fast: null });
  const [loading, setLoading] = useState(false);

  const slowSql = typeof slow.sql === 'function' ? slow.sql(tableSizes) : slow.sql;
  const fastSql = typeof fast.sql === 'function' ? fast.sql(tableSizes) : fast.sql;

  async function dropAllUserIndexes() {
    const r = await runQuery(db!, `SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL`);
    const names = (r.results[0]?.values ?? []).map((row) => String(row[0]));
    for (const name of names) {
      await runQuery(db!, `DROP INDEX IF EXISTS "${name}"`);
    }
  }

  async function handleRun() {
    if (!db) return;
    setLoading(true);
    setResults({ slow: null, fast: null });

    await dropAllUserIndexes();
    if (before) await before(db);
    const slowResult = await runQueryWithPlan(db, slowSql);
    recordQuery({
      sql: slowSql,
      label: slow.label,
      durationMs: slowResult.durationMs,
      rowCount: slowResult.results[0]?.values.length ?? 0,
      isError: !!slowResult.error,
    });

    if (setup) await setup(db);
    const fastResult = await runQueryWithPlan(db, fastSql);
    recordQuery({
      sql: fastSql,
      label: fast.label,
      durationMs: fastResult.durationMs,
      rowCount: fastResult.results[0]?.values.length ?? 0,
      isError: !!fastResult.error,
    });

    setResults({ slow: slowResult, fast: fastResult });
    setLoading(false);
  }

  const bothRan = results.slow && results.fast;

  return (
    <div className="flex flex-col gap-5">
      {/* Column headers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wide truncate">
              {slow.label}
            </span>
          </div>
          <div
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3 overflow-x-auto"
            style={{ borderColor: 'var(--color-code-border)' }}
          >
            <SqlBlock sql={slowSql} />
          </div>
          <ExecutionPlanPanel
            result={results.slow}
            loading={loading && !results.slow}
            tableSizes={tableSizes}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand)] shrink-0" />
            <span className="text-xs font-semibold text-[var(--color-brand-dark)] uppercase tracking-wide truncate">
              {fast.label}
            </span>
          </div>
          <div
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3 overflow-x-auto"
            style={{ borderColor: 'var(--color-code-border)' }}
          >
            <SqlBlock sql={fastSql} />
          </div>
          <ExecutionPlanPanel
            result={results.fast}
            loading={loading && !results.fast}
            tableSizes={tableSizes}
          />
        </div>
      </div>

      {/* Run button + speedup */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleRun}
          disabled={loading || !db}
          className={[
            'px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
            loading || !db
              ? 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
              : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white',
          ].join(' ')}
        >
          {loading ? 'Running…' : 'Run comparison'}
        </button>

        {bothRan && <SpeedupBadge slow={results.slow!} fast={results.fast!} />}
      </div>

      {/* Insight */}
      {bothRan && insight && (
        <div className="rounded-xl bg-[var(--color-brand-light)] border border-[var(--color-brand-muted)] px-4 py-3">
          <p className="text-xs font-semibold text-[var(--color-brand-dark)] mb-1">Why it's faster</p>
          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
            {typeof insight === 'function' ? insight(tableSizes) : insight}
          </p>
        </div>
      )}
    </div>
  );
}
