# GTFS Workbench

Query, optimize, validate, and visualise GTFS transit feeds — all in your browser. Load any GTFS `.zip` from disk or fetch directly from a curated list of public agencies, write ad-hoc SQL with live execution plans, run guided optimization scenarios, scan for feed health issues, and plot stops on a live map filtered by route.

All SQL querying runs entirely in the browser (WebAssembly SQLite via [sql.js](https://sql.js.org/)). A companion NestJS API handles the one thing the browser can't: fetching feeds from external URLs without hitting CORS restrictions.

Built as a portfolio piece to demonstrate practical knowledge of query performance on real-world datasets.

**Live demo:** [gtfs-workbench-krystynaszurs-projects.vercel.app](https://gtfs-workbench-93cbcrfmm-krystynaszurs-projects.vercel.app/)

![GTFS Workbench — Route Map tab](docs/screenshot.gif)

---

## What it does

GTFS (General Transit Feed Specification) is the open data format used by thousands of transit agencies worldwide. A single feed can contain millions of rows — Montreal's STM feed has ~14 million `stop_times` records alone.

This app loads a GTFS `.zip` entirely in the browser using [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly) and demonstrates how query choices affect real execution time on that data.

### Fetching public feeds

A dropdown on the load screen lets you fetch a live GTFS feed without downloading anything manually. Picking an agency calls the NestJS backend, which fetches the zip server-side and streams the bytes back to the browser. The browser can't do this itself — most transit agencies don't set permissive CORS headers.

The backend exposes two endpoints:

| Endpoint | What it does |
|---|---|
| `GET /feeds` | Returns the list of available agencies (name, city, country) |
| `POST /feeds/fetch` | Accepts a feed `id`, fetches the upstream zip, streams it back |

Feed URLs are kept server-side — the client sends only an opaque `id` validated against a whitelist. This prevents the backend from being used as an open proxy (SSRF). The zip is streamed rather than buffered, so the browser starts receiving bytes before the backend has finished downloading.

If the backend is unreachable, the dropdown is silently hidden and manual drag-and-drop upload continues to work.

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

Plot every stop from the feed on an interactive Leaflet map. Select a route from the dropdown to filter to only that route's stops — the map auto-fits to the result.

- Routes in the dropdown are sorted numerically then alphabetically (route 14 before 139)
- The route filter runs a `SELECT DISTINCT` join across `stop_times → trips → stops`, demonstrating exactly why an index on `stop_times(trip_id)` matters on large feeds
- Selecting a route reveals the Index Inspector inline — create the index and re-filter without leaving the tab
- Circle markers use the transit brand palette; stop name appears on hover

### Schema explorer

The feed header strip shows the file name and total row count at a glance. Click **Browse tables** to expand the full sortable table browser; click any table row to inspect its column list — useful when writing queries in the free editor.

---

## Tech stack

### Frontend

| Tool | Role |
|------|------|
| React 19 + TypeScript | UI |
| Vite 8 | Build tool |
| Tailwind CSS v4 | Styling |
| sql.js 1.14 | SQLite compiled to WASM |
| JSZip | Unzipping GTFS feeds in the browser |
| Web Worker | Keeps sql.js off the main thread |
| Leaflet + react-leaflet | Interactive stop map |

### Backend (`backend/`)

| Tool | Role |
|------|------|
| NestJS 10 + TypeScript | API framework |
| Node.js `fetch` + `Readable.fromWeb` | Streams upstream zips to the client |

---

## Running locally

### Frontend

```bash
git clone https://github.com/krystynaszur/gtfs-workbench.git
cd gtfs-workbench
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and upload any GTFS `.zip` file. The drag-and-drop loader works without the backend running.

### Backend (optional — enables the public feed dropdown)

```bash
cd backend
npm install
npm run start:dev
```

The API listens on `http://localhost:3001`. Vite proxies `/api/*` to it automatically in dev, so no extra configuration is needed.

**Sample feeds to try (manual upload):**
- [STM Montreal](https://www.stm.info/en/about/developers) — large feed, good for seeing timing differences
- [GTFS Schedule Sample Feed](https://gtfs.org/getting-started/example-feed/) — small, good for quick testing

---

## Project structure

```
src/                           # React frontend
  contexts/
    DBContext.tsx              # db instance, loading state, progress, table row counts
  components/
    FeedLoader.tsx             # drag-and-drop upload with progress bar
    FeedPicker.tsx             # dropdown that fetches a feed via the NestJS API
    FeedStats.tsx              # compact strip (feed name + row count) with expandable table browser
    QueryComparator.tsx        # slow/fast runner — drops user indexes, shows speedup badge
    ExecutionPlanPanel.tsx     # EXPLAIN QUERY PLAN tree: badges, scan bars, timing, rows ratio
    FreeQueryEditor.tsx        # query editor + plan + hints + Indexes/History sub-tabs
    IndexInspector.tsx         # live index list with create (table+column form) and drop actions
    QueryHistory.tsx           # accordion log of every query run with timing and full SQL
    ScenarioPanel.tsx          # wraps QueryComparator with scenario description
    FeedValidator.tsx          # automated feed health checks (8 checks, 4 categories)
    RouteMap.tsx               # Leaflet stop map with route dropdown filter + inline IndexInspector
  lib/
    gtfsLoader.ts              # unzips feed, parses CSVs, loads into sql.js via Web Worker
    queryRunner.ts             # timing wrapper + EXPLAIN QUERY PLAN parser (PlanNode tree)
    queryHistory.ts            # module-level pub/sub store for query history
    scenarios.ts               # re-exports the four scenario definitions
    types.ts                   # Scenario interface
  scenarios/
    stopTimesIndex.ts          # scenario 1: index on stop_times
    joinOrder.ts               # scenario 2: aggregate before joining
    spatialBoundingBox.ts      # scenario 3: bounding-box spatial filter
    calendarService.ts         # scenario 4: materialise active services
  workers/
    db.worker.ts               # Web Worker: owns all sql.js state, handles load + query messages
  App.tsx

backend/                       # NestJS API
  src/
    feeds/
      feeds.controller.ts      # GET /feeds, POST /feeds/fetch
      feeds.service.ts         # whitelisted feed registry, 30 s timeout, streaming fetch
      feeds.module.ts
    app.module.ts
    main.ts                    # CORS + PORT from env vars
```

### Data pipeline

`loadGtfsFeed(file)` → Web Worker → JSZip unzip → CSV parse → `INSERT` into SQLite tables → returns a `DbHandle`

All CSV columns are stored as `TEXT` (schema derived from each file's headers at load time), so the loader works with any GTFS feed regardless of optional fields. Numeric comparisons use SQLite's implicit casting.

`runQueryWithPlan(handle, sql)` → runs `EXPLAIN QUERY PLAN` and the query in parallel → parses the flat plan rows into a `PlanNode` tree → returns `{ results, durationMs, plan }`

### Plan node classification

The parser recognises SQLite 3.39+ output formats including `CO-ROUTINE` (lazy CTE, mapped to the same CTE badge as `MATERIALIZE`) and `CORRELATED SCALAR SUBQUERY` (mapped to the SUBQUERY badge).

---

## Build and deploy

### Frontend (Vercel)

```bash
npm run build     # outputs to dist/
npm run preview   # preview the production build locally
```

Deployed on Vercel — push to `main` triggers a new deploy.

Set these environment variables in Vercel → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `VITE_SAMPLE_FEED_URL` | `/sample-feed.zip` |
| `VITE_SAMPLE_FEED_NAME` | `Sample Feed` |
| `VITE_API_URL` | Your Railway backend URL (e.g. `https://gtfs-api-production.railway.app`) |

`VITE_API_URL` enables the public feed dropdown in production. Without it the dropdown is hidden and manual upload still works.

### Backend (Railway)

1. New project → Deploy from GitHub → select this repo
2. Set **Root Directory** to `backend`
3. Add environment variable: `CORS_ORIGIN` = your Vercel frontend URL (e.g. `https://gtfs-workbench.vercel.app`)
4. Railway injects `PORT` automatically — `main.ts` reads it with `process.env.PORT ?? 3001`

Railway auto-detects Node.js, runs `npm install` + `npm run build` + `npm run start`, and assigns a public URL.

### Sample feed

A small sample feed is bundled at `public/sample-feed.zip` and served as a static asset. To enable the one-click **Load sample feed** button locally, add to `.env.local`:

```
VITE_SAMPLE_FEED_URL=/sample-feed.zip
VITE_SAMPLE_FEED_NAME=Sample Feed
```

---

## Key findings at scale

Measured against the STM Montreal feed (~14 M `stop_times` rows) in WASM SQLite:

- `stop_times` is always the largest table (often 10–100× bigger than `trips`)
- Without an index, `WHERE trip_id = ?` on 14 M rows takes ~800 ms in WASM SQLite; with `idx_st_trip` it drops to ~2 ms
- Calendar resolution requires checking both `calendar` (weekly pattern) and `calendar_dates` (exceptions) — a correlated subquery against both re-scans thousands of rows per trip
- A ±0.05° bounding box (`WHERE stop_lat BETWEEN ? AND ?`) before distance math cuts the candidate set from 10 K stops to ~50 before any floating-point computation runs
- Real feeds are rarely clean — the STM Montreal feed has 79 expired service periods, 9 expiring within 30 days, and 1 stop missing coordinates, all surfaced instantly by the Feed Validator; referential integrity was intact
- Filtering the Route Map by route joins `stop_times → trips → stops` across millions of rows; adding an index on `stop_times(trip_id)` turns a multi-second scan into a near-instant lookup — visible live in the app
