import type { QueryResult } from '../lib/gtfsLoader';

const MAX_ROWS = 200;

interface ResultsPanelProps {
  result: QueryResult | null;
  loading?: boolean;
  label?: string;
}

function TimingBadge({ ms }: { ms: number }) {
  const [bg, text] =
    ms < 10  ? ['bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]',  ''] :
    ms < 100 ? ['bg-amber-50 text-amber-700', ''] :
               ['bg-red-50 text-red-600', ''];
  return (
    <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>
      {ms < 1 ? '<1' : ms.toFixed(1)} ms
    </span>
  );
}

export function ResultsPanel({ result, loading = false, label }: ResultsPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-[var(--color-text-muted)] animate-pulse">
        Running query…
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-[var(--color-text-muted)]">
        {label ?? 'Run a query to see results'}
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
        <p className="text-xs font-semibold text-red-600 mb-1">Error</p>
        <pre className="text-xs text-red-500 whitespace-pre-wrap font-mono">{result.error}</pre>
      </div>
    );
  }

  if (result.results.length === 0) {
    return (
      <div className="flex items-center justify-between py-3 px-1">
        <span className="text-sm text-[var(--color-text-muted)]">No rows returned</span>
        <TimingBadge ms={result.durationMs} />
      </div>
    );
  }

  const { columns, values } = result.results[0];
  const truncated = values.length > MAX_ROWS;
  const rows = truncated ? values.slice(0, MAX_ROWS) : values;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-[var(--color-text-muted)]">
          {truncated
            ? `${MAX_ROWS} of ${values.length.toLocaleString()}`
            : values.length.toLocaleString()}{' '}
          row{values.length !== 1 ? 's' : ''}
          {truncated && <span className="text-amber-600 ml-1">(truncated)</span>}
        </span>
        <TimingBadge ms={result.durationMs} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="bg-[var(--color-subtle)] border-b border-[var(--color-border)]">
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left text-[var(--color-text-secondary)] font-semibold whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={[
                  'border-b border-[var(--color-border)] last:border-0',
                  i % 2 !== 0 ? 'bg-[var(--color-subtle)]' : 'bg-[var(--color-surface)]',
                ].join(' ')}
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 text-[var(--color-text-primary)] whitespace-nowrap max-w-48 truncate">
                    {cell === null
                      ? <span className="text-[var(--color-text-muted)] italic">null</span>
                      : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
