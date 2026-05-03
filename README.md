# GTFS Workbench

Query, optimize, validate, and visualise GTFS transit feeds — all in your browser. Load any real GTFS `.zip`, write ad-hoc SQL with live execution plans, run guided optimization scenarios, scan for feed health issues, and plot stops on a live map filtered by route. No server required.

Built as a portfolio piece to demonstrate practical knowledge of query performance on real-world datasets.

**Live demo:** _coming soon (Vercel)_

---

## What it does

GTFS (General Transit Feed Specification) is the open data format used by thousands of transit agencies worldwide. A single feed can contain millions of rows — Montreal's STM feed has ~14 million `stop_times` records alone.

This app loads a GTFS `.zip` entirely in the browser using [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly) and demonstrates how query choices affect real execution time on that data.

### Free Query Editor

Write any SQL against the loaded feed and immediately see:

- **Execution plan** — the full `EXPLAIN QUERY PLAN` tree with colour-coded operation badges (red SCAN, green SEARCH, amber SORT, blue CTE), scan bars proportional to table size, and a rows-read-per-result ratio
- **Optimization hints** — a rule-based engine inspects the plan and flags full table scans, correlated subqueries, and missing `LIMIT` clauses; detected scan columns get a one-click *Create index* action
- **Index workshop** — create indexes by picking table and column from dropdowns, drop them individually, and re-run your query to watch the plan change from SCAN to SEARCH
- **Query history** — every query is logged with timing, row count, and a label; click any entry to expand the full SQL
- `CREATE INDEX` / `DROP INDEX` statements run cleanly and report execution time without breaking the plan panel

### Scenario Lab

Four curated slow vs. fast query pairs, each with a side-by-side execution plan, speedup badge, and plain-English explanation:

| # | Scenario | Optimization |
|---|----------|--------------|
| 1 | Look up stops for a trip | Index on `stop_times(trip_id)` — SCAN → SEARCH |
| 2 | Count trips per route | Aggregate before joining — correlated subquery → CTE |
| 3 | Find stops near a location | Bounding-box pre-filter before distance math |
| 4 | Check which trips run today | Materialise active services once vs per-row subqueries |

User-created indexes are automatically dropped before each scenario run to keep the comparisons clean.

### Feed Validator

Runs automatically when a feed is loaded. Eight checks across four categories:

| Category | Check | Severity |
|----------|-------|----------|
| Services | Expired service periods | error |
| Services | Services expiring within 30 days | warning |
| Routes & Trips | Routes without trips | warning |
| Routes & Trips | Trips without stop times | error |
| Stops | Stops missing coordinates | error |
| Referential Integrity | Stop times → unknown stops | error |
| Referential Integrity | Stop times → unknown trips | error |
| Referential Integrity | Trips → unknown routes | error |

Each check shows a pass/warning/error badge with a plain-English message. Tables absent from the feed are silently skipped.

### Route Map

Plot every stop from the feed on an interactive Leaflet map. Select a route from the dropdown to filter to only that route's stops — the map auto-fits to the result. The route filter runs a `SELECT DISTINCT` join across `stop_times → trips → stops`, which on a large feed demonstrates exactly why an index on `stop_times(trip_id)` matters: selecting a route triggers the Index Inspector inline so you can create the index and re-filter without leaving the tab.

- Circle markers use the transit brand palette (green fill, dark green border)
- Routes in the dropdown are sorted numerically then alphabetically, so route 14 appears before 139
- Index Inspector appears below the map only when a route is selected

### Schema explorer

The feed header strip shows the file name and total row count at a glance. Click **Browse tables** to expand the full sortable table browser; click any table row to inspect its column list — useful when writing queries in the free editor.

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
| Leaflet + react-leaflet | Interactive stop map |

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
    DBContext.tsx          # db instance, loading state, progress, table row counts
  components/
    FeedLoader.tsx         # drag-and-drop upload with progress bar
    FeedStats.tsx          # compact strip (feed name + row count) with expandable sortable table browser
    QueryComparator.tsx    # slow/fast runner — drops user indexes, shows speedup badge
    ExecutionPlanPanel.tsx # EXPLAIN QUERY PLAN tree: badges, scan bars, timing, rows ratio
    FreeQueryEditor.tsx    # query editor + plan + hints + Indexes/History sub-tabs
    IndexInspector.tsx     # live index list with create (table+column form) and drop actions
    QueryHistory.tsx       # accordion log of every query run with timing and full SQL
    ScenarioPanel.tsx      # wraps QueryComparator with scenario description
    FeedValidator.tsx      # automated feed health checks (8 checks, 4 categories)
    RouteMap.tsx           # Leaflet stop map with route dropdown filter + inline IndexInspector
  lib/
    gtfsLoader.ts          # unzips feed, parses CSVs, loads into sql.js via Web Worker
    queryRunner.ts         # timing wrapper + EXPLAIN QUERY PLAN parser (PlanNode tree)
    queryHistory.ts        # module-level pub/sub store for query history
    scenarios.ts           # re-exports the four scenario definitions
    types.ts               # Scenario interface
  scenarios/
    stopTimesIndex.ts      # scenario 1: index on stop_times
    joinOrder.ts           # scenario 2: aggregate before joining
    spatialBoundingBox.ts  # scenario 3: bounding-box spatial filter
    calendarService.ts     # scenario 4: materialise active services
  workers/
    db.worker.ts           # Web Worker: owns all sql.js state, handles load + query messages
  App.tsx
```

### Data pipeline

`loadGtfsFeed(file)` → Web Worker → JSZip unzip → CSV parse → `INSERT` into SQLite tables → returns a `DbHandle`

All CSV columns are stored as `TEXT` (schema derived from each file's headers at load time), so the loader works with any GTFS feed regardless of optional fields. Numeric comparisons use SQLite's implicit casting.

`runQueryWithPlan(handle, sql)` → runs `EXPLAIN QUERY PLAN` and the query in parallel → parses the flat plan rows into a `PlanNode` tree → returns `{ results, durationMs, plan }`

### Plan node classification

The parser recognises SQLite 3.39+ output formats including `CO-ROUTINE` (lazy CTE, mapped to the same CTE badge as `MATERIALIZE`) and `CORRELATED SCALAR SUBQUERY` (mapped to the SUBQUERY badge).

---

## Build and deploy

```bash
npm run build     # outputs to dist/
npm run preview   # preview the production build locally
```

Deployed on Vercel — push to `main` triggers a new deploy.

### Sample feed (optional)

To enable the one-click "Load sample feed" button, add to `.env.local`:

```
VITE_SAMPLE_FEED_URL=https://your-cdn.com/gtfs-sample.zip
VITE_SAMPLE_FEED_NAME=STM Montreal
```

---

## Key findings at scale

- `stop_times` is always the largest table (often 10–100× bigger than `trips`)
- Without an index, `WHERE trip_id = ?` on 14 M rows takes ~800 ms in WASM SQLite; with `idx_st_trip` it drops to ~2 ms
- Calendar resolution requires checking both `calendar` (weekly pattern) and `calendar_dates` (exceptions) — a correlated subquery against both re-scans thousands of rows per trip
- A ±0.05° bounding box (`WHERE stop_lat BETWEEN ? AND ?`) before distance math cuts the candidate set from 10 K stops to ~50 before any floating-point computation runs
