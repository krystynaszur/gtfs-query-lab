import { useRef, useState, useCallback } from 'react';
import { useDB } from '../contexts/DBContext';

const SAMPLE_FEED_URL = import.meta.env.VITE_SAMPLE_FEED_URL as string | undefined;
const SAMPLE_FEED_NAME = import.meta.env.VITE_SAMPLE_FEED_NAME as string | undefined;

export function FeedLoader() {
  const { loadFeed, loading, progress, error } = useDB();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.name.endsWith('.zip')) {
        setFetchError('Please select a .zip file.');
        return;
      }
      setFetchError(null);
      loadFeed(file);
    },
    [loadFeed],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleSampleFeed = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!SAMPLE_FEED_URL) return;
      setFetchError(null);
      try {
        const res = await fetch(SAMPLE_FEED_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        loadFeed(buf, SAMPLE_FEED_NAME ?? 'sample-feed.zip');
      } catch (err) {
        setFetchError(`Failed to fetch sample feed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [loadFeed],
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {progress?.stage ?? 'Loading…'}
        </p>
        <div className="w-72 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-brand)] rounded-full transition-all duration-300"
            style={{ width: `${progress?.percent ?? 0}%` }}
          />
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">{progress?.percent ?? 0}%</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload GTFS feed"
        className={[
          'w-full max-w-lg border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer',
          'bg-[var(--color-surface)] transition-colors duration-150 select-none',
          isDragOver
            ? 'border-[var(--color-brand)] bg-[var(--color-brand-light)]'
            : 'border-[var(--color-border-strong)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-light)]',
        ].join(' ')}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="text-4xl mb-4">🚌</div>
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          Drop a GTFS{' '}
          <code className="text-sm bg-[var(--color-subtle)] border border-[var(--color-border)] px-1.5 py-0.5 rounded font-mono">
            .zip
          </code>{' '}
          here
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">or click to browse</p>
      </div>

      {SAMPLE_FEED_URL && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-muted)]">or</span>
          <button
            onClick={handleSampleFeed}
            className="text-sm text-[var(--color-brand-dark)] hover:underline font-medium"
          >
            Load {SAMPLE_FEED_NAME ?? 'sample feed'}
          </button>
        </div>
      )}

      {(error ?? fetchError) && (
        <p className="mt-4 text-sm text-red-500">{error ?? fetchError}</p>
      )}

      <p className="mt-8 text-xs text-[var(--color-text-muted)] max-w-sm text-center">
        All processing happens in your browser — no data is uploaded anywhere.
      </p>
    </div>
  );
}
