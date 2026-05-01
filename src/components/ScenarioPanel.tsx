import { useState } from 'react';
import type { Scenario } from '../lib/types';
import type { QueryResult } from '../lib/gtfsLoader';
import { useDB } from '../contexts/DBContext';
import { runQuery } from '../lib/queryRunner';
import { QueryEditor } from './QueryEditor';
import { ResultsPanel } from './ResultsPanel';

interface ScenarioPanelProps {
  scenario: Scenario;
}

type RunState = { slow: QueryResult | null; fast: QueryResult | null };

export function ScenarioPanel({ scenario }: ScenarioPanelProps) {
  const { db } = useDB();
  const [results, setResults] = useState<RunState>({ slow: null, fast: null });
  const [loading, setLoading] = useState(false);

  async function handleRunComparison() {
    if (!db) return;
    setLoading(true);
    setResults({ slow: null, fast: null });

    if (scenario.setup) await scenario.setup(db);

    const [slow, fast] = await Promise.all([
      runQuery(db, scenario.slow.sql),
      runQuery(db, scenario.fast.sql),
    ]);

    setResults({ slow, fast });
    setLoading(false);
  }

  const bothRan = results.slow && results.fast;
  const speedup =
    bothRan && results.slow!.durationMs > 0
      ? results.slow!.durationMs / results.fast!.durationMs
      : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{scenario.description}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Slow */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">
              {scenario.slow.label}
            </span>
          </div>
          <QueryEditor
            defaultValue={scenario.slow.sql}
            onRun={(sql) => runQuery(db!, sql).then((r) => setResults((p) => ({ ...p, slow: r })))}
            loading={loading}
            readOnly
          />
          <ResultsPanel result={results.slow} loading={loading && !results.slow} label="Run comparison to see results" />
        </div>

        {/* Fast */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand)] inline-block" />
            <span className="text-xs font-semibold text-[var(--color-brand-dark)] uppercase tracking-wide">
              {scenario.fast.label}
            </span>
          </div>
          <QueryEditor
            defaultValue={scenario.fast.sql}
            onRun={(sql) => runQuery(db!, sql).then((r) => setResults((p) => ({ ...p, fast: r })))}
            loading={loading}
            readOnly
          />
          <ResultsPanel result={results.fast} loading={loading && !results.fast} label="Run comparison to see results" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleRunComparison}
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

        {speedup !== null && (
          <span className="text-sm text-[var(--color-text-secondary)]">
            Fast query was{' '}
            <span className={[
              'font-semibold',
              speedup >= 1 ? 'text-[var(--color-brand-dark)]' : 'text-red-500',
            ].join(' ')}>
              {speedup >= 1 ? `${speedup.toFixed(1)}× faster` : `${(1 / speedup).toFixed(1)}× slower`}
            </span>
          </span>
        )}
      </div>

      {bothRan && (
        <div className="rounded-xl bg-[var(--color-brand-light)] border border-[var(--color-brand-muted)] px-4 py-3">
          <p className="text-xs font-semibold text-[var(--color-brand-dark)] mb-1">Why it's faster</p>
          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{scenario.insight}</p>
        </div>
      )}
    </div>
  );
}
