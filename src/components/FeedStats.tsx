import { useEffect, useState, useMemo } from 'react';
import { useDB } from '../contexts/DBContext';
import { runQuery } from '../lib/queryRunner';

type TableStat = { name: string; rows: number };
type SortKey = 'default' | 'name' | 'rows';
type SortDir = 'asc' | 'desc';

const TABLE_ORDER = [
  'agency', 'routes', 'trips', 'stop_times',
  'stops', 'calendar', 'calendar_dates', 'shapes',
  'transfers', 'feed_info',
];

function SortButton({
  label, sortKey, active, dir, onClick,
}: {
  label: string; sortKey: SortKey; active: boolean; dir: SortDir; onClick: (k: SortKey) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(sortKey); }}
      className={[
        'flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors',
        active
          ? 'text-[var(--color-brand-dark)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
      ].join(' ')}
    >
      {label}
      <span className="text-[10px]">{active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
    </button>
  );
}

export function FeedStats() {
  const { db, feedName } = useDB();
  const [stats, setStats] = useState<TableStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [columnCache, setColumnCache] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!db) { setStats([]); setExpandedTable(null); setColumnCache({}); return; }
    setLoadingStats(true);

    async function fetchStats() {
      const tablesResult = await runQuery(db!, `SELECT name FROM sqlite_master WHERE type='table'`);
      const names = (tablesResult.results[0]?.values ?? []).map((v) => String(v[0]));

      const rows = await Promise.all(
        names.map(async (name) => {
          const r = await runQuery(db!, `SELECT COUNT(*) FROM "${name}"`);
          return { name, rows: Number(r.results[0]?.values[0]?.[0] ?? 0) };
        }),
      );

      setStats(rows);
      setLoadingStats(false);
    }

    fetchStats();
  }, [db]);

  async function handleRowClick(name: string) {
    if (expandedTable === name) {
      setExpandedTable(null);
      return;
    }
    setExpandedTable(name);
    if (!columnCache[name] && db) {
      const result = await runQuery(db, `PRAGMA table_info("${name}")`);
      const cols = (result.results[0]?.values ?? []).map((row) => String(row[1]));
      setColumnCache((prev) => ({ ...prev, [name]: cols }));
    }
  }

  function handleSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'rows' ? 'desc' : 'asc');
    }
  }

  const sorted = useMemo(() => {
    const copy = [...stats];
    if (sortKey === 'default') {
      copy.sort((a, b) => {
        const ai = TABLE_ORDER.indexOf(a.name);
        const bi = TABLE_ORDER.indexOf(b.name);
        if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    } else if (sortKey === 'name') {
      copy.sort((a, b) => a.name.localeCompare(b.name) * (sortDir === 'asc' ? 1 : -1));
    } else {
      copy.sort((a, b) => (a.rows - b.rows) * (sortDir === 'asc' ? 1 : -1));
    }
    return copy;
  }, [stats, sortKey, sortDir]);

  if (!db) return null;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Feed loaded</h2>
          {feedName && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">{feedName}</p>
          )}
        </div>
        {loadingStats && (
          <span className="text-xs text-[var(--color-text-muted)] animate-pulse">counting rows…</span>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-subtle)]">
            <th className="px-5 py-2.5 text-left">
              <div className="flex items-center gap-3">
                <SortButton label="Table" sortKey="name" active={sortKey === 'name'} dir={sortDir} onClick={handleSortClick} />
                {sortKey !== 'default' && (
                  <button
                    onClick={() => { setSortKey('default'); setSortDir('asc'); }}
                    className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                  >
                    reset
                  </button>
                )}
              </div>
            </th>
            <th className="px-5 py-2.5 text-right">
              <SortButton label="Rows" sortKey="rows" active={sortKey === 'rows'} dir={sortDir} onClick={handleSortClick} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ name, rows }, i) => {
            const isExpanded = expandedTable === name;
            const cols = columnCache[name];
            return (
              <>
                <tr
                  key={name}
                  onClick={() => handleRowClick(name)}
                  className={[
                    'border-b border-[var(--color-border)] cursor-pointer transition-colors',
                    isExpanded
                      ? 'bg-[var(--color-brand-light)]'
                      : i % 2 !== 0
                        ? 'bg-[var(--color-subtle)] hover:bg-[var(--color-brand-light)]'
                        : 'hover:bg-[var(--color-brand-light)]',
                    name === 'stop_times' ? 'font-semibold' : '',
                  ].join(' ')}
                >
                  <td className="px-5 py-2.5 font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          'text-[10px] transition-transform duration-150',
                          isExpanded ? 'rotate-90' : '',
                          'text-[var(--color-text-muted)]',
                        ].join(' ')}
                      >
                        ▶
                      </span>
                      <span className={
                        name === 'stop_times'
                          ? 'text-[var(--color-brand-dark)]'
                          : 'text-[var(--color-text-primary)]'
                      }>
                        {name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-[var(--color-text-secondary)]">
                    {rows.toLocaleString()}
                  </td>
                </tr>

                {isExpanded && (
                  <tr key={`${name}-cols`} className="border-b border-[var(--color-border)] bg-[var(--color-brand-light)]">
                    <td colSpan={2} className="px-5 py-3">
                      {!cols ? (
                        <span className="text-xs text-[var(--color-text-muted)] animate-pulse">
                          loading columns…
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {cols.map((col) => (
                            <span
                              key={col}
                              className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-text-secondary)]"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
