import { useState } from 'react';
import { useDB } from '../contexts/DBContext';
import { runQuery, runQueryWithPlan } from '../lib/queryRunner';
import type { PlanNode, QueryResultWithPlan } from '../lib/queryRunner';
import { recordQuery } from '../lib/queryHistory';
import { QueryEditor } from './QueryEditor';
import { ResultsPanel } from './ResultsPanel';
import { ExecutionPlanPanel } from './ExecutionPlanPanel';
import { IndexInspector } from './IndexInspector';
import { QueryHistory } from './QueryHistory';

const DEFAULT_SQL = `SELECT route_short_name, COUNT(DISTINCT trip_id) AS trips
FROM routes
JOIN trips USING (route_id)
GROUP BY route_short_name
ORDER BY trips DESC
LIMIT 15`;

const DDL_RE = /^\s*(CREATE|DROP)\s+(INDEX|TABLE|VIEW|TRIGGER)/i;

// ── Hint engine ───────────────────────────────────────────────────────────────

interface HintItem {
  text: string;
  action?: { label: string; sql: string };
}

function fmtRows(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function guessFilterColumn(sql: string, table: string): string | null {
  // Only use table-qualified references to avoid borrowing columns from
  // unrelated parts of the SQL (e.g. outer WHERE when the table is in a subquery).
  const patterns = [
    new RegExp(`\\b${table}\\.(\\w+)\\s*(?:=|<|>|\\bIN\\b|\\bBETWEEN\\b)`, 'i'),
    new RegExp(`ON\\s+${table}\\.(\\w+)\\s*=`, 'i'),
    new RegExp(`=\\s*${table}\\.(\\w+)`, 'i'),
  ];
  for (const p of patterns) {
    const col = sql.match(p)?.[1];
    if (col) return col;
  }
  return null;
}

function anyIndexUsed(nodes: PlanNode[]): boolean {
  for (const n of nodes) {
    if (n.operation === 'SEARCH' && n.index) return true;
    if (anyIndexUsed(n.children)) return true;
  }
  return false;
}

function deriveHints(
  plan: PlanNode[],
  tableSizes: Record<string, number>,
  sql: string,
): HintItem[] {
  const hints: HintItem[] = [];
  const scannedTables = new Set<string>();
  let sortHinted = false;
  let subqueryHinted = false;

  // If any index is already being used, a residual sort is on a small
  // filtered result — not worth flagging.
  const indexAlreadyUsed = anyIndexUsed(plan);

  function walk(nodes: PlanNode[]) {
    for (const node of nodes) {
      if (node.operation === 'SCAN' && node.table && !scannedTables.has(node.table)) {
        const rows = tableSizes[node.table] ?? 0;
        if (rows >= 1_000) {
          scannedTables.add(node.table);
          const col = guessFilterColumn(sql, node.table);
          hints.push({
            text: `${node.table} (${fmtRows(rows)} rows) is fully scanned.` +
              (col ? `` : ` If you filter this table, add an index on that column to replace the scan.`),
            action: col ? {
              label: `Create index on ${node.table}(${col})`,
              sql: `CREATE INDEX IF NOT EXISTS idx_${node.table}_${col} ON ${node.table}(${col})`,
            } : undefined,
          });
        }
      }

      if (node.operation === 'SUBQUERY' && !subqueryHinted) {
        subqueryHinted = true;
        hints.push({
          text: `A correlated subquery re-executes for every outer row. Rewriting as a CTE computes it once.`,
        });
      }

      if (node.operation === 'SORT' && !sortHinted && !indexAlreadyUsed) {
        sortHinted = true;
        hints.push({
          text: `This query sorts its full result set with no index in play. ` +
                `An index on your ORDER BY column can eliminate this sort.`,
        });
      }

      walk(node.children);
    }
  }

  walk(plan);

  if (!/\bLIMIT\b/i.test(sql) && !DDL_RE.test(sql)) {
    hints.push({ text: `No LIMIT clause — all matching rows will be returned.` });
  }

  return hints;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Panel = 'indexes' | 'history';

export function FreeQueryEditor() {
  const { db, tableSizes } = useDB();
  const [result, setResult] = useState<QueryResultWithPlan | null>(null);
  const [lastSql, setLastSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexFeedback, setIndexFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [panel, setPanel] = useState<Panel>('indexes');

  const isLastDdl = DDL_RE.test(lastSql);

  async function handleRun(sql: string) {
    if (!db) return;
    setLoading(true);
    setLastSql(sql);
    setIndexFeedback(null);

    if (DDL_RE.test(sql)) {
      const r = await runQuery(db, sql);
      setResult({ ...r, plan: [] });
      recordQuery({ sql, durationMs: r.durationMs, rowCount: 0, isError: !!r.error });
    } else {
      const r = await runQueryWithPlan(db, sql);
      setResult(r);
      recordQuery({
        sql,
        durationMs: r.durationMs,
        rowCount: r.results[0]?.values.length ?? 0,
        isError: !!r.error,
      });
    }

    setLoading(false);
  }

  async function handleCreateIndex(sql: string) {
    if (!db) return;
    const r = await runQuery(db, sql);
    setIndexFeedback(
      r.error
        ? { isError: true, message: r.error }
        : { isError: false, message: 'Index created — re-run your query to see the plan change.' },
    );
  }

  const hints = result && !isLastDdl ? deriveHints(result.plan, tableSizes, lastSql) : [];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        Write any SQL against the loaded GTFS feed. After each run the execution plan
        appears alongside your results — and the hint engine flags common performance
        issues automatically. You can also run <span className="font-mono">CREATE INDEX</span> and{' '}
        <span className="font-mono">DROP INDEX</span> statements to explore how indexes change the plan.
      </p>

      <QueryEditor defaultValue={DEFAULT_SQL} onRun={handleRun} loading={loading} />

      {/* DDL result */}
      {result && isLastDdl && (
        <div className={[
          'rounded-xl border px-4 py-3 text-sm',
          result.error
            ? 'border-red-200 bg-red-50 text-red-600 font-mono'
            : 'border-[var(--color-border)] bg-[var(--color-subtle)] text-[var(--color-text-muted)]',
        ].join(' ')}>
          {result.error ?? `Statement executed in ${result.durationMs < 1 ? '<1' : result.durationMs.toFixed(1)} ms — re-run your SELECT to see the updated plan.`}
        </div>
      )}

      {/* Plan + results (SELECT queries) */}
      {(result || loading) && !isLastDdl && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Execution plan
            </span>
            <ExecutionPlanPanel result={result} loading={loading} tableSizes={tableSizes} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Results
            </span>
            <ResultsPanel result={result} loading={loading} />
          </div>
        </div>
      )}

      {/* Hints */}
      {result && !isLastDdl && !result.error && (
        hints.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Optimization hints
            </p>
            <ul className="flex flex-col gap-3">
              {hints.map((hint, i) => (
                <li key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-2.5 text-sm text-[var(--color-text-primary)]">
                    <span className="text-amber-500 shrink-0 mt-0.5">▲</span>
                    {hint.text}
                  </div>
                  {hint.action && (
                    <div className="ml-5 flex items-center gap-2">
                      <code className="text-[11px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                        {hint.action.sql}
                      </code>
                      <button
                        onClick={() => handleCreateIndex(hint.action!.sql)}
                        className="text-[11px] font-semibold text-[var(--color-brand-dark)] hover:underline shrink-0"
                      >
                        Run ↗
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {indexFeedback && (
              <p className={[
                'text-xs mt-1 px-1',
                indexFeedback.isError ? 'text-red-600 font-mono' : 'text-[var(--color-brand-dark)]',
              ].join(' ')}>
                {indexFeedback.message}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--color-brand-muted)] bg-[var(--color-brand-light)] px-4 py-3 flex items-center gap-3">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[var(--color-brand-dark)] shrink-0">
              <circle cx="10" cy="10" r="8" />
              <polyline points="7 10 9 12 13 8" />
            </svg>
            <p className="text-sm text-[var(--color-brand-dark)] font-medium">
              No obvious issues detected in this query's plan.
            </p>
          </div>
        )
      )}

      {/* Indexes / History sub-tabs */}
      <div className="border-t border-[var(--color-border)] pt-5 flex flex-col gap-4">
        <div className="flex gap-1 border-b border-[var(--color-border)]">
          {(['indexes', 'history'] as Panel[]).map((p) => (
            <button
              key={p}
              onClick={() => setPanel(p)}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
                panel === p
                  ? 'border-[var(--color-brand)] text-[var(--color-brand-dark)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
              ].join(' ')}
            >
              {p === 'indexes' ? 'Indexes' : 'Query History'}
            </button>
          ))}
        </div>
        {panel === 'indexes' && <IndexInspector />}
        {panel === 'history' && <QueryHistory />}
      </div>
    </div>
  );
}
