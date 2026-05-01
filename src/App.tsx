import { useRef } from 'react';
import { loadGtfsFeed } from './lib/gtfsLoader';
import { runQuery } from './lib/queryRunner';

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('Loading feed…');
    const db = await loadGtfsFeed(file, (p) =>
      console.log(`[${p.percent}%] ${p.stage}`),
    );

    const result = await runQuery(db, 'SELECT COUNT(*) FROM stop_times');
    console.log('stop_times count:', result.results[0]?.values[0]?.[0]);
    console.log(`Query took ${result.durationMs.toFixed(2)} ms`);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">GTFS Query Lab</h1>
      <p className="mb-4 text-gray-600">Drop a GTFS .zip to test the loader:</p>
      <input ref={inputRef} type="file" accept=".zip" onChange={handleFile} />
    </div>
  );
}
