import { useRef, useState, useCallback } from 'react';
import { useDB } from '../contexts/DBContext';

// To enable a one-click sample feed, set VITE_SAMPLE_FEED_URL in .env.local
// e.g. VITE_SAMPLE_FEED_URL=https://your-cdn.com/gtfs-sample.zip
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
        <p className="text-sm font-medium text-gray-500">{progress?.stage ?? 'Loading…'}</p>
        <div className="w-72 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress?.percent ?? 0}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">{progress?.percent ?? 0}%</p>
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
          'w-full max-w-lg border-2 border-dashed rounded-xl p-12 text-center cursor-pointer',
          'transition-colors duration-150 select-none',
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800',
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
        <div className="text-4xl mb-4">📦</div>
        <p className="text-base font-medium text-gray-700 dark:text-gray-200">
          Drop a GTFS <code className="text-sm bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">.zip</code> here
        </p>
        <p className="text-sm text-gray-400 mt-1">or click to browse</p>
      </div>

      {SAMPLE_FEED_URL && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-gray-400">or</span>
          <button
            onClick={handleSampleFeed}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Load {SAMPLE_FEED_NAME ?? 'sample feed'}
          </button>
        </div>
      )}

      {(error ?? fetchError) && (
        <p className="mt-4 text-sm text-red-500">{error ?? fetchError}</p>
      )}

      <p className="mt-8 text-xs text-gray-400 max-w-sm text-center">
        All processing happens in your browser — no data is uploaded anywhere.
      </p>
    </div>
  );
}
