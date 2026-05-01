import type { PlanNode, PlanOperation, QueryResultWithPlan } from '../lib/queryRunner';

// ── Badge config ──────────────────────────────────────────────────────────────

const BADGE: Record<PlanOperation, { label: string; bg: string; text: string }> = {
  SCAN:        { label: 'SCAN',        bg: 'bg-red-100',    text: 'text-red-700'   },
  SEARCH:      { label: 'SEARCH',      bg: 'bg-[var(--color-brand-light)]', text: 'text-[var(--color-brand-dark)]' },
  SORT:        { label: 'SORT',        bg: 'bg-amber-100',  text: 'text-amber-700' },
  MATERIALIZE: { label: 'CTE',         bg: 'bg-blue-100',   text: 'text-blue-700'  },
  SUBQUERY:    { label: 'SUBQUERY',    bg: 'bg-purple-100', text: 'text-purple-700'},
  COMPOUND:    { label: 'COMPOUND',    bg: 'bg-gray-100',   text: 'text-gray-600'  },
  OTHER:       { label: 'OP',          bg: 'bg-gray-100',   text: 'text-gray-500'  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timingColor(ms: number): string {
  if (ms < 10)  return 'text-[var(--color-brand-dark)]';
  if (ms < 100) return 'text-amber-600';
  return 'text-red-600';
}

// ── Scan bar ──────────────────────────────────────────────────────────────────

function ScanBar({
  node,
  tableSizes,
  maxSize,
}: {
  node: PlanNode;
  tableSizes: Record<string, number>;
  maxSize: number;
}) {
  if (!node.table || maxSize === 0) return null;
  const isScan = node.operation === 'SCAN';
  const tableRows = tableSizes[node.table] ?? 0;
  if (!isScan || tableRows === 0) return null;

  const pct = Math.max(2, (tableRows / maxSize) * 100);

  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div
          className="h-full bg-red-400 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-[var(--color-text-muted)] w-10 text-right">
        {fmt(tableRows)}
      </span>
    </div>
  );
}

// ── Plan tree node ────────────────────────────────────────────────────────────

function PlanNodeRow({
  node,
  depth,
  tableSizes,
  maxSize,
}: {
  node: PlanNode;
  depth: number;
  tableSizes: Record<string, number>;
  maxSize: number;
}) {
  const badge = BADGE[node.operation];
  // Trim the leading keyword from detail so we don't duplicate the badge label
  const trimmed = node.detail
    .replace(/^(SCAN TABLE|SEARCH TABLE|SCAN|SEARCH|MATERIALIZE|CO-ROUTINE|USE TEMP B-TREE FOR|SCAN SUBQUERY)\s*/i, '')
    .trim();

  return (
    <>
      <div style={{ paddingLeft: `${depth * 16}px` }} className="py-1.5">
        <div className="flex items-start gap-2">
          {depth > 0 && (
            <span className="text-[var(--color-border-strong)] text-xs mt-0.5 shrink-0">└</span>
          )}
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
          <span className="text-xs text-[var(--color-text-primary)] font-mono leading-tight break-all">
            {trimmed || node.detail}
            {node.index && (
              <span className="ml-1.5 text-[var(--color-brand-dark)] font-semibold">
                ({node.index})
              </span>
            )}
          </span>
        </div>
        <ScanBar node={node} tableSizes={tableSizes} maxSize={maxSize} />
      </div>
      {node.children.map((child) => (
        <PlanNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          tableSizes={tableSizes}
          maxSize={maxSize}
        />
      ))}
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface ExecutionPlanPanelProps {
  result: QueryResultWithPlan | null;
  loading?: boolean;
  tableSizes: Record<string, number>;
  label?: string;
}

export function ExecutionPlanPanel({
  result,
  loading = false,
  tableSizes,
  label,
}: ExecutionPlanPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-[var(--color-text-muted)] animate-pulse">
        Running…
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-[var(--color-text-muted)]">
        {label ?? 'Run comparison to see results'}
      </div>
    );
  }

  const rowCount = result.results[0]?.values.length ?? 0;
  const maxSize = Math.max(...Object.values(tableSizes), 1);

  // Estimate rows scanned: table size for each SCAN, rowCount for each SEARCH
  function sumScanned(nodes: PlanNode[]): number {
    let total = 0;
    for (const n of nodes) {
      if (n.operation === 'SCAN' && n.table) {
        total += tableSizes[n.table] ?? 0;
      } else if (n.operation === 'SEARCH') {
        total += rowCount;
      }
      total += sumScanned(n.children);
    }
    return total;
  }

  const rowsScanned = sumScanned(result.plan);
  const ratio = rowCount > 0 ? Math.round(rowsScanned / rowCount) : null;

  const allNodes = result.plan;
  const hasPlan = allNodes.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Timing */}
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold tabular-nums ${timingColor(result.durationMs)}`}>
          {result.durationMs < 1 ? '<1' : result.durationMs.toFixed(1)}
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">ms</span>
      </div>

      {result.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs text-red-500 font-mono">{result.error}</p>
        </div>
      )}

      {/* Plan tree */}
      {hasPlan && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-subtle)] px-3 py-2 divide-y divide-[var(--color-border)]">
          {allNodes.map((node) => (
            <PlanNodeRow
              key={node.id}
              node={node}
              depth={0}
              tableSizes={tableSizes}
              maxSize={maxSize}
            />
          ))}
        </div>
      )}

      {/* Footer: rows scanned / returned / ratio */}
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>
          <span className="font-semibold text-[var(--color-text-primary)]">{fmt(rowCount)}</span>
          {' rows returned'}
          {rowsScanned > 0 && (
            <> · scanned ~<span className="font-semibold text-[var(--color-text-primary)]">{fmt(rowsScanned)}</span></>
          )}
        </span>
        {ratio !== null && ratio > 1 && (
          <span className="tabular-nums">
            <span className="font-semibold text-[var(--color-text-primary)]">
              {ratio.toLocaleString()}
            </span>
            {' rows read per result'}
          </span>
        )}
      </div>
    </div>
  );
}
