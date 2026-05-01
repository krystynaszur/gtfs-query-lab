import { useState, useEffect, useCallback } from 'react';
import { useDB } from '../contexts/DBContext';
import { runQuery } from '../lib/queryRunner';

interface IndexRow {
  name: string;
  table: string;
  columns: string;
}

function parseColumns(sql: string): string {
  const m = sql.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : '?';
}

export function IndexInspector() {
  const { db, tableSizes } = useDB();
  const [indexes, setIndexes] = useState<IndexRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTable, setNewTable] = useState('');
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [newColumn, setNewColumn] = useState('');
  const [creating, setCreating] = useState(false);

  const tables = Object.keys(tableSizes).sort();

  const fetchIndexes = useCallback(async () => {
    if (!db) return;
    const r = await runQuery(
      db,
      `SELECT name, tbl_name, sql FROM sqlite_master
       WHERE type = 'index' AND sql IS NOT NULL
       ORDER BY tbl_name, name`,
    );
    setIndexes(
      (r.results[0]?.values ?? []).map((row) => ({
        name: String(row[0]),
        table: String(row[1]),
        columns: parseColumns(String(row[2] ?? '')),
      })),
    );
  }, [db]);

  // Auto-refresh to pick up indexes created/dropped elsewhere (e.g. scenarios)
  useEffect(() => {
    if (!db) { setIndexes([]); return; }
    fetchIndexes();
    const interval = setInterval(fetchIndexes, 1500);
    return () => clearInterval(interval);
  }, [db, fetchIndexes]);

  // Load columns when table selection changes
  useEffect(() => {
    if (!newTable || !db) { setTableColumns([]); setNewColumn(''); return; }
    runQuery(db, `PRAGMA table_info("${newTable}")`).then((r) => {
      const cols = (r.results[0]?.values ?? []).map((row) => String(row[1]));
      setTableColumns(cols);
      setNewColumn(cols[0] ?? '');
    });
  }, [newTable, db]);

  async function handleCreate() {
    if (!db || !newTable || !newColumn || creating) return;
    setCreating(true);
    const name = `idx_${newTable}_${newColumn}`;
    await runQuery(db, `CREATE INDEX IF NOT EXISTS "${name}" ON "${newTable}"("${newColumn}")`);
    await fetchIndexes();
    setCreating(false);
    setShowCreate(false);
    setNewTable('');
    setNewColumn('');
  }

  async function handleDrop(name: string) {
    if (!db) return;
    await runQuery(db, `DROP INDEX IF EXISTS "${name}"`);
    await fetchIndexes();
  }

  if (!db) return null;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Indexes</h2>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className={[
            'text-xs font-semibold px-2 py-0.5 rounded transition-colors',
            showCreate
              ? 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
              : 'bg-[var(--color-brand-light)] text-[var(--color-brand-dark)] hover:bg-[var(--color-brand-muted)]',
          ].join(' ')}
        >
          {showCreate ? 'Cancel' : '+ New'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-subtle)] flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Table
            </label>
            <select
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              className="w-full text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 focus:outline-none focus:border-[var(--color-brand)]"
            >
              <option value="">— select —</option>
              {tables.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Column
            </label>
            <select
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value)}
              disabled={tableColumns.length === 0}
              className="w-full text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 focus:outline-none focus:border-[var(--color-brand)] disabled:opacity-50"
            >
              {tableColumns.length === 0
                ? <option value="">— pick a table first —</option>
                : tableColumns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {newTable && newColumn && (
            <p className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">
              idx_{newTable}_{newColumn}
            </p>
          )}

          <button
            onClick={handleCreate}
            disabled={!newTable || !newColumn || creating}
            className={[
              'w-full py-1.5 rounded-lg text-xs font-semibold transition-colors',
              !newTable || !newColumn || creating
                ? 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white',
            ].join(' ')}
          >
            {creating ? 'Creating…' : 'Create index'}
          </button>
        </div>
      )}

      {/* Index list */}
      {indexes.length === 0 ? (
        <p className="px-4 py-4 text-xs text-[var(--color-text-muted)] leading-relaxed">
          No user indexes. Create one above or run a scenario to see indexes appear here.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {indexes.map((idx) => (
            <li key={idx.name} className="px-4 py-2.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold text-[var(--color-brand-dark)] truncate">
                  {idx.name}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {idx.table}
                  <span className="text-[var(--color-text-secondary)]"> ({idx.columns})</span>
                </p>
              </div>
              <button
                onClick={() => handleDrop(idx.name)}
                className="text-[10px] text-[var(--color-text-muted)] hover:text-red-500 transition-colors shrink-0 mt-0.5"
                title="Drop this index"
              >
                Drop
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
