import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import JSZip from 'jszip';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim()); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  return { headers: parseCsvLine(lines[0]), rows: lines.slice(1).map(parseCsvLine) };
}

// ── Table loading ─────────────────────────────────────────────────────────────

const GTFS_FILES = new Set([
  'agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt',
  'calendar.txt', 'calendar_dates.txt', 'shapes.txt', 'transfers.txt', 'feed_info.txt',
]);

async function loadTable(db: Database, zip: JSZip, filePath: string): Promise<void> {
  const baseName = filePath.split('/').pop()!;
  const tableName = baseName.replace('.txt', '');
  const text = await zip.files[filePath].async('text');
  const { headers, rows } = parseCsv(text);
  if (headers.length === 0) return;

  const colDefs = headers.map((h) => `"${h}" TEXT`).join(', ');
  db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs})`);
  if (rows.length === 0) return;

  const placeholders = headers.map(() => '?').join(', ');
  const colList = headers.map((h) => `"${h}"`).join(', ');
  const insertSql = `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders})`;

  db.run('BEGIN TRANSACTION');
  try {
    const stmt = db.prepare(insertSql);
    for (const row of rows) {
      const normalized =
        row.length < headers.length
          ? [...row, ...Array<string>(headers.length - row.length).fill('')]
          : row.slice(0, headers.length);
      stmt.run(normalized);
    }
    stmt.free();
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

// ── Worker message protocol ───────────────────────────────────────────────────

let db: Database | null = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, id, ...payload } = event.data as Record<string, unknown> & { type: string; id: number };

  if (type === 'load') {
    try {
      self.postMessage({ type: 'progress', stage: 'Initializing database…', percent: 0 });
      const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
      db = new SQL.Database();

      self.postMessage({ type: 'progress', stage: 'Unzipping feed…', percent: 10 });
      const zip = await JSZip.loadAsync(payload.buffer as ArrayBuffer);

      const relevant = Object.keys(zip.files).filter((path) => {
        const base = path.split('/').pop() ?? '';
        return GTFS_FILES.has(base) && !zip.files[path].dir;
      });

      for (let i = 0; i < relevant.length; i++) {
        const filePath = relevant[i];
        const base = filePath.split('/').pop()!;
        const percent = 20 + Math.round((i / relevant.length) * 75);
        self.postMessage({ type: 'progress', stage: `Loading ${base}…`, percent });
        await loadTable(db, zip, filePath);
      }

      self.postMessage({ type: 'ready', id });
    } catch (err) {
      self.postMessage({ type: 'error', id, error: String(err) });
    }

  } else if (type === 'query') {
    if (!db) {
      self.postMessage({ type: 'result', id, results: [], durationMs: 0, error: 'No database loaded' });
      return;
    }
    const start = performance.now();
    try {
      const results = db.exec(payload.sql as string);
      self.postMessage({ type: 'result', id, results, durationMs: performance.now() - start });
    } catch (err) {
      self.postMessage({ type: 'result', id, results: [], durationMs: performance.now() - start, error: String(err) });
    }
  }
};
