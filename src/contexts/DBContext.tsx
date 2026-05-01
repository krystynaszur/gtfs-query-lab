import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { loadGtfsFeed } from '../lib/gtfsLoader';
import type { DbHandle, LoadProgress } from '../lib/gtfsLoader';
import { runQuery } from '../lib/queryRunner';

type DBContextValue = {
  db: DbHandle | null;
  feedName: string | null;
  loading: boolean;
  progress: LoadProgress | null;
  error: string | null;
  tableSizes: Record<string, number>;
  loadFeed: (source: File | ArrayBuffer, name?: string) => Promise<void>;
};

const DBContext = createContext<DBContextValue | null>(null);

export function DBProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DbHandle | null>(null);
  const [feedName, setFeedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tableSizes, setTableSizes] = useState<Record<string, number>>({});
  const currentDb = useRef<DbHandle | null>(null);

  const loadFeed = useCallback(async (source: File | ArrayBuffer, name?: string) => {
    currentDb.current?.terminate();
    setDb(null);
    setTableSizes({});
    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      const handle = await loadGtfsFeed(source, setProgress);
      currentDb.current = handle;
      setDb(handle);
      setFeedName(name ?? (source instanceof File ? source.name : 'feed.zip'));

      // Fetch table sizes once — used by ExecutionPlanPanel for scan bar widths
      const tablesResult = await runQuery(handle, `SELECT name FROM sqlite_master WHERE type='table'`);
      const names = (tablesResult.results[0]?.values ?? []).map((v) => String(v[0]));
      const sizes: Record<string, number> = {};
      await Promise.all(
        names.map(async (n) => {
          const r = await runQuery(handle, `SELECT COUNT(*) FROM "${n}"`);
          sizes[n] = Number(r.results[0]?.values[0]?.[0] ?? 0);
        }),
      );
      setTableSizes(sizes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <DBContext.Provider value={{ db, feedName, loading, progress, error, tableSizes, loadFeed }}>
      {children}
    </DBContext.Provider>
  );
}

export function useDB() {
  const ctx = useContext(DBContext);
  if (!ctx) throw new Error('useDB must be used inside DBProvider');
  return ctx;
}
