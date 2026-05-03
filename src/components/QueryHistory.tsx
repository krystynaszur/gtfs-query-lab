import { useState, useEffect, useSyncExternalStore } from 'react';
import { getHistory, clearHistory, subscribeHistory } from '../lib/queryHistory';

function sqlPreview(sql: string): string {
  const first = sql
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('--'));
  const line = first ?? sql.trim();
  return line.length > 60 ? line.slice(0, 60) + '…' : line;
}

function fmtAge(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function TimingBadge({ ms }: { ms: number }) {
  const cls =
    ms < 10 ? 'bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]' :
    ms < 100 ? 'bg-amber-50 text-amber-700' :
    'bg-red-50 text-red-600';
  return (
    <span className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${cls}`}>
      {ms < 1 ? '<1' : ms.toFixed(1)}ms
    </span>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  return (
    <pre
      className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed"
      style={{ color: 'var(--color-code-text)' }}
    >
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

export function QueryHistory() {
  const entries = useSyncExternalStore(subscribeHistory, getHistory);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  function copyToClipboard(id: number, sql: string) {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-4">
        No queries run yet. Results will appear here after each run.
      </p>
    );
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Query History</h2>
        <button
          onClick={clearHistory}
          className="text-sm text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
        >
          clear
        </button>
      </div>

      <ul className="divide-y divide-[var(--color-border)] max-h-96 overflow-y-auto">
        {entries.map((entry) => {
          const isOpen = expandedId === entry.id;
          return (
            <li key={entry.id} className="flex flex-col">
              <button
                onClick={() => setExpandedId(isOpen ? null : entry.id)}
                className="w-full text-left px-4 py-2.5 flex flex-col gap-1 hover:bg-[var(--color-subtle)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <TimingBadge ms={entry.durationMs} />
                    {entry.label && (
                      <span className="text-xs text-[var(--color-text-muted)] truncate">
                        {entry.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-[var(--color-text-muted)]">
                      {fmtAge(entry.timestamp)}
                    </span>
                    <svg
                      className={[
                        'w-6 h-6 text-[var(--color-brand)] transition-transform duration-150 shrink-0',
                        isOpen ? 'rotate-180' : '',
                      ].join(' ')}
                      viewBox="0 0 16 16" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <polyline points="4 6 8 10 12 6" />
                    </svg>
                  </div>
                </div>

                <span className="text-xs font-mono text-[var(--color-text-secondary)] truncate">
                  {sqlPreview(entry.sql)}
                </span>

                <span className="text-xs text-[var(--color-text-muted)]">
                  {entry.isError
                    ? <span className="text-red-500">error</span>
                    : `${entry.rowCount.toLocaleString()} row${entry.rowCount !== 1 ? 's' : ''}`}
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 pt-2 bg-[var(--color-code-bg)] border-t border-[var(--color-border)]">
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(entry.id, entry.sql); }}
                      className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[#B8D4C4] transition-colors"
                    >
                      {copiedId === entry.id ? (
                        <>
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                            <polyline points="3 8 6 11 13 4" />
                          </svg>
                          Copied
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                            <rect x="5" y="5" width="9" height="9" rx="1" />
                            <path d="M11 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <SqlBlock sql={entry.sql} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
