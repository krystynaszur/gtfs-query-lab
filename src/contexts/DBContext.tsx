import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { loadGtfsFeed } from '../lib/gtfsLoader';
import type { DbHandle, LoadProgress } from '../lib/gtfsLoader';

type DBContextValue = {
  db: DbHandle | null;
  feedName: string | null;
  loading: boolean;
  progress: LoadProgress | null;
  error: string | null;
  loadFeed: (source: File | ArrayBuffer, name?: string) => Promise<void>;
};

const DBContext = createContext<DBContextValue | null>(null);

export function DBProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DbHandle | null>(null);
  const [feedName, setFeedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentDb = useRef<DbHandle | null>(null);

  const loadFeed = useCallback(async (source: File | ArrayBuffer, name?: string) => {
    currentDb.current?.terminate();
    setDb(null);
    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      const handle = await loadGtfsFeed(source, setProgress);
      currentDb.current = handle;
      setDb(handle);
      setFeedName(name ?? (source instanceof File ? source.name : 'feed.zip'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <DBContext.Provider value={{ db, feedName, loading, progress, error, loadFeed }}>
      {children}
    </DBContext.Provider>
  );
}

export function useDB() {
  const ctx = useContext(DBContext);
  if (!ctx) throw new Error('useDB must be used inside DBProvider');
  return ctx;
}
