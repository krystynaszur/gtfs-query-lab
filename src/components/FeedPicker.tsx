import { useEffect, useState } from 'react';
import { useDB } from '../contexts/DBContext';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

type FeedMeta = { id: string; name: string; city: string; country: string };

export function FeedPicker({ compact = false }: { compact?: boolean }) {
  const { loadFeed, loading } = useDB();
  const [feeds, setFeeds] = useState<FeedMeta[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/feeds`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<FeedMeta[]>;
      })
      .then(setFeeds)
      .catch(() => {
        // Backend unavailable — component stays hidden, drag-and-drop still works
      });
  }, []);

  if (feeds.length === 0 || loading) return null;

  const handleLoad = async () => {
    if (!selectedId) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/feeds/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const buf = await res.arrayBuffer();
      const feed = feeds.find((f) => f.id === selectedId);
      await loadFeed(buf, `${feed?.name ?? selectedId} (${feed?.city})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetching(false);
    }
  };

  const select = (
    <select
      value={selectedId}
      onChange={(e) => setSelectedId(e.target.value)}
      disabled={fetching}
      className={[
        'flex-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)]',
        'px-3 py-2 text-sm text-[var(--color-text-primary)]',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]',
        fetching ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <option value="">Select a transit agency…</option>
      {feeds.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name} — {f.city}, {f.country}
        </option>
      ))}
    </select>
  );

  const button = (
    <button
      onClick={handleLoad}
      disabled={!selectedId || fetching}
      className={[
        'px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap',
        'bg-[var(--color-brand)] text-white',
        !selectedId || fetching
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-[var(--color-brand-dark)]',
      ].join(' ')}
    >
      {fetching ? 'Fetching…' : 'Load'}
    </button>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {select}
        {button}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <div className="flex items-center gap-3 w-full max-w-lg">
        <div className="flex-1 h-px bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-text-muted)] px-1 whitespace-nowrap">
          or fetch a public feed
        </span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>
      <div className="flex items-center gap-2 w-full max-w-lg">
        {select}
        {button}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
