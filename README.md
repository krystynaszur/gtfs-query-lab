# GTFS Query Lab

An interactive tool for loading real transit feeds and exploring SQL query optimization in the browser — no server required.

Built as a portfolio piece to demonstrate practical knowledge of query performance: indexes, join ordering, spatial filtering, and calendar resolution on production-scale GTFS data.

**Live demo:** _coming soon (Vercel)_

---

## What it does

GTFS (General Transit Feed Specification) is the open data format used by thousands of transit agencies worldwide. A single feed can contain millions of rows — Montreal's STM feed has ~14 million stop_time records alone.

This app loads a GTFS `.zip` entirely in the browser using [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly) and demonstrates how query choices affect real execution time on that data.

### Two modes

**Free query editor** — write any SQL against the loaded feed and see results with timing.

**Scenario lab** — four curated slow vs. fast query pairs, each with a plain-English explanation of why the faster version wins:

| # | Scenario | Optimization technique |
|---|----------|------------------------|
| 1 | Filtering stop times | Index on `stop_times(trip_id)` |
| 2 | Route lookup | Filter before join, not after |
| 3 | Nearest stops | Bounding-box spatial pre-filter |
| 4 | Is this trip running today? | Calendar + `calendar_dates` resolution |

---

## Tech stack

| Tool | Role |
|------|------|
| React 19 + TypeScript | UI |
| Vite 8 | Build tool |
| Tailwind CSS v4 | Styling |
| sql.js 1.14 | SQLite compiled to WASM |
| JSZip | Unzipping GTFS feeds in the browser |
| Web Worker | Keeps sql.js off the main thread |

---

## Running locally

```bash
git clone https://github.com/YOUR_USERNAME/gtfs-query-lab.git
cd gtfs-query-lab
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) and upload any GTFS `.zip` file.

**Sample feeds to try:**
- [STM Montreal](https://www.stm.info/en/about/developers) — large feed, good for seeing timing differences
- [GTFS Schedule Sample Feed](https://github.com/google/transit/tree/master/gtfs/spec/en) — small, good for quick testing

---

## Project structure

```
src/
  contexts/
    DBContext.tsx      # React context: db instance, loading state, progress, error
  components/
    FeedLoader.tsx     # Drag & drop upload with progress bar; optional sample feed via env var
    FeedStats.tsx      # Row counts per table, sortable by name or count
  lib/
    gtfsLoader.ts      # Unzips feed, parses CSVs, loads into sql.js via Web Worker
    queryRunner.ts     # Wraps db.query() with performance timing
  workers/
    db.worker.ts       # Web Worker: owns all sql.js state, handles load + query messages
  App.tsx
```

### Data pipeline

`loadGtfsFeed(file)` → Web Worker → JSZip unzip → CSV parse → `INSERT` into SQLite tables → returns a `DbHandle`

All CSV columns are stored as `TEXT` (schema is derived from each file's headers at load time), making the loader work with any GTFS feed regardless of optional fields. Numeric comparisons in queries use SQLite's implicit casting.

`runQuery(handle, sql)` → worker `postMessage` → `db.exec()` with `performance.now()` timing → `{ results, durationMs }`

### Sample feed

To enable the one-click "Load sample feed" button, add to `.env.local`:

```
VITE_SAMPLE_FEED_URL=https://your-cdn.com/gtfs-sample.zip
VITE_SAMPLE_FEED_NAME=STM Montreal
```

---

## Build and deploy

```bash
npm run build     # outputs to dist/
npm run preview   # preview the production build locally
```

Deployed on Vercel — push to `main` triggers a new deploy.

---

## What I learned about GTFS at scale

_Full write-up coming in Day 9_ — short version:

- `stop_times` is always the largest table by far (often 10–100× bigger than `trips`)
- Without an index, a `WHERE trip_id = ?` scan on 14M rows takes ~800ms in WASM SQLite; with an index it drops to ~2ms
- Calendar resolution is deceptively complex: you can't just query `calendar` — you have to check `calendar_dates` for exceptions (a service might run on a holiday it normally skips, or be cancelled on a day it normally runs)
- Bounding-box filtering (`WHERE stop_lat BETWEEN ? AND ?`) before computing distances is the standard "poor man's spatial index" — it cuts the candidate set from 10k stops to ~50 before any math happens
