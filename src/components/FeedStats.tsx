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
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={[
        'flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors',
        active
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
      ].join(' ')}
    >
      {label}
      <span className="text-[10px]">
        {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </button>
  );
}

export function FeedStats() {
  const { db, feedName } = useDB();
  const [stats, setStats] = useState<TableStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    if (!db) { setStats([]); return; }
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
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Feed loaded</h2>
          {feedName && (
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{feedName}</p>
          )}
        </div>
        {loadingStats && (
          <span className="text-xs text-gray-400 animate-pulse">counting rows…</span>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <th className="px-5 py-2.5 text-left">
              <div className="flex items-center gap-3">
                <SortButton label="Table" sortKey="name" active={sortKey === 'name'} dir={sortDir} onClick={handleSortClick} />
                {sortKey !== 'default' && (
                  <button
                    onClick={() => { setSortKey('default'); setSortDir('asc'); }}
                    className="text-[10px] text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                    title="Reset sort"
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
          {sorted.map(({ name, rows }, i) => (
            <tr
              key={name}
              className={[
                'border-b border-gray-50 dark:border-gray-800 last:border-0',
                i % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-800/40',
                name === 'stop_times'
                  ? 'font-semibold text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300',
              ].join(' ')}
            >
              <td className="px-5 py-2.5 font-mono">{name}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">{rows.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
