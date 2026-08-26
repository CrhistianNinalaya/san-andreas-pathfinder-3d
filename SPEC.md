# San Andreas Pathfinder 3D — Technical Specification

**Status:** Draft for approval · **Date:** 2026-08-25 · **Supersedes:** nothing (first spec)

This document proposes where the project goes and how it gets there. It is a proposal, not a
finished decision — sections marked **⚠ Decision needed** are open.

Read [`docs/CODE-REVIEW.md`](docs/CODE-REVIEW.md) first for the measured state of the current code.

---

## 1. Where this is going

Today: a working A\* demo on a GTA map.

Target: **the route planner the GTA:SA community actually uses** — you open a link, you get a map
that loads in under two seconds, you type "Grove Street" and "Las Venturas Airport", you get a route
with real terrain physics, and you paste the URL in a Discord and someone else sees the same route.

That target implies five things the current app cannot do:

1. Search places by name (there are no names in the dataset).
2. Share a route (there is no state in the URL).
3. Work on a phone (the panel is a fixed 360 px box over a mouse-driven map).
4. Load fast enough that people don't bounce (5.52 MB and 210 ms of blocked main thread).
5. Speak Spanish and English (the audience is majority Spanish-speaking; the UI is English-only).

Everything below serves those five.

---

## 2. Constraints

These were decided, not assumed. They bound every proposal in this document.

| # | Constraint | Consequence |
|---|---|---|
| C1 | **No libraries for the UI layer.** Components, panels, inputs, modals, layout are hand-written. | No MUI / Chakra / shadcn / Ant / Tailwind. Plain CSS Modules + custom properties. |
| C2 | **Libraries are fine everywhere else** — don't reinvent wheels outside the UI. | Leaflet, Vite, Vitest, React itself are all in scope. |
| C3 | **Leaflet stays.** | The map engine is not rewritten. React talks to it through one imperative bridge. |
| C4 | **React + TypeScript.** | Strict mode. No `any` in `libs/`. |
| C5 | **Use the right language per job.** Python where it beats JS for data work. | The extraction/packing pipeline is Python. This creates a build-time backend, not a runtime one. |
| C6 | **Nx monorepo.** | Enforced boundaries between UI, domain, and pipeline; one task runner across JS and Python. |
| C7 | **Product for the community**, not a portfolio piece. | Features get shipped and maintained; i18n and mobile are requirements, not extras. |
| C8 | **Binary dataset + Web Worker.** | The main thread never parses or builds the graph. |

---

## 3. Do we need a backend?

**Short answer: a build-time one yes, a runtime one not until Phase 5.**

This is the biggest architectural question, so here is the reasoning rather than the conclusion alone.

### 3.1 Routing does not need a server

The measured numbers make the case:

| | Client-side (proposed) | Server-side API |
|---|---|---|
| Cross-state route | **31 ms** today, ~15 ms after CSR | 40–120 ms network RTT *before* any compute |
| Marker drag → new route | instant, per frame | one request per drag event, or debounce and feel laggy |
| Cost at 10k users | $0, it's a static file on a CDN | a service to run, scale, and pay for |
| Offline / flaky connection | works after first load | dead |

The entire graph is **602 KB packed**. Shipping it once and routing locally is strictly better than
a routing API on every dimension that matters here. **Reject a routing backend.**

### 3.2 Data preparation absolutely needs a backend — but it's offline

Parsing Rockstar's `NODES.DAT`, stitching 144 `.txd` radar tiles, building the tile pyramid,
assembling the POI dataset, computing connected components, packing the binary — this is batch data
work. Python owns it: `struct`, `numpy`, `Pillow`, `scipy` do in twenty lines what JS does in two
hundred, and it runs on a laptop or in CI, never in a request.

So the split is:

```
build time  ──►  tools/pipeline (Python)  ──►  static artifacts  ──►  runtime (React, no server)
                 NODES.DAT, .txd, POIs         .sapg, tiles, .json
```

**This is the backend.** It is a pipeline, not a service. Its output is committed (or published to
a CDN) and the frontend is a pure static site.

### 3.3 One feature does need a runtime service — later

**Short links for shared routes.** A route with 8 waypoints encodes to ~120 characters in a URL,
which is fine for a Discord paste but ugly. If we want `sapf.app/r/x7k2m`, we need persistence.

That is **one serverless function plus a KV store** (Vercel Functions + Vercel KV, or Cloudflare
Workers + KV). Not a service, not a database, no auth. Deferred to Phase 5 and explicitly optional —
Phase 3 ships full URL state without it.

### 3.4 Verdict

| Concern | Where it lives |
|---|---|
| Route computation | Browser (Web Worker) |
| Graph data preparation | Python pipeline, build time |
| Map tiles | Python pipeline → static files |
| POI / place names | Python pipeline → static JSON |
| Short links (Phase 5, optional) | One edge function + KV |
| Everything else | Static hosting |

**⚠ Decision needed:** whether Phase 5 short links are in scope at all. Full URL state (no server)
covers 90% of the value.

---

## 4. Architecture

### 4.1 Nx workspace layout

```
san-andreas-pathfinder-3d/
├── apps/
│   ├── web/                        React + Vite app. Thin: composition and routing only.
│   │   ├── src/features/           map/ · waypoints/ · route-panel/ · search/ · settings/
│   │   ├── src/app/                shell, layout, i18n provider, error boundary
│   │   └── src/worker/             graph worker entry + typed message protocol
│   └── web-e2e/                    Playwright smoke suite
│
├── libs/
│   ├── pathfinding/                ★ pure domain. A*, MinHeap, CSR graph, components.
│   │                               Zero imports. Zero DOM. 100% unit-testable.
│   ├── terrain/                    ★ pure domain. Elevation physics, vehicle profiles.
│   ├── graph-format/               ★ .sapg binary reader/writer + format version constants.
│   │                               Shared contract between Python writer and TS reader.
│   ├── geo/                        ★ coordinate systems. GTA world ↔ Leaflet ↔ image pixels.
│   ├── map-bridge/                 Leaflet ↔ React. The ONLY place that imports leaflet.
│   ├── ui/                         Hand-written primitives: Button, Panel, Field, Sheet, Icon.
│   │                               No third-party UI code (C1).
│   └── i18n/                       Typed dictionaries + useTranslation. ~40 lines, no library.
│
├── tools/
│   ├── pipeline/                   ★ Python. NODES.DAT → .sapg, .txd → tiles, POI assembly.
│   ├── verify-graph.mjs            Dataset invariants + connectivity (exists, works today).
│   └── bench-route.mjs             A* benchmark on fixed OD pairs (exists, works today).
│
├── docs/
│   ├── CODE-REVIEW.md              Measured audit of the pre-migration code.
│   ├── adr/                        Architecture decision records, one file per decision.
│   └── graph-format.md             The .sapg binary format, normative.
│
└── .claude/                        skills/ and commands/ for agent-assisted work.
```

★ = no dependency on React, Leaflet, or the DOM. These are the parts that survive any future
rewrite of the UI, and they are where the tests go.

### 4.2 Enforced dependency rules

Nx module boundary tags, enforced by lint, not by discipline:

```
apps/web         →  may import  libs/*
libs/map-bridge  →  may import  libs/geo, libs/ui        (and leaflet)
libs/ui          →  may import  nothing
libs/pathfinding →  may import  libs/graph-format
libs/terrain     →  may import  nothing
libs/geo         →  may import  nothing
libs/graph-format→  may import  nothing
```

The rule that matters: **`libs/pathfinding` may never import `leaflet` or touch `document`.** That
single constraint is what makes the engine testable, worker-safe, and portable. It is the thing the
current `app.js` gets wrong.

### 4.3 The Leaflet ↔ React bridge (C3)

Leaflet owns imperative, mutable map state. React owns declarative UI state. Mixing them is the
classic failure mode of this kind of app. One pattern, applied consistently:

- **React never re-renders the map.** One `<MapContainer>` creates the Leaflet instance once in an
  effect with an empty dep array and hands it out via context.
- **Layers are managed by effects keyed on data, not by JSX.** A `useRouteLayer(route)` hook diffs
  the previous polyline against the new one and mutates Leaflet directly. No `react-leaflet`.
- **Leaflet events dispatch into React state**, never the reverse. `map.on('click')` → dispatch
  `WAYPOINT_ADDED`. React state is the single source of truth for waypoints; the markers are a
  projection of it.
- **Markers are `L.divIcon` wrapping a React portal** where a marker needs real interactivity;
  plain `divIcon` HTML where it doesn't. Pins today are the latter — leave them.

`libs/map-bridge` is the only package allowed to `import 'leaflet'`. Everything else works in GTA
world coordinates and never sees a `LatLng`.

### 4.4 State

No state library (C1 in spirit — this is not a wheel worth importing at this size).

- **Route state** (waypoints, active alternative, vehicle profile, scope) → one `useReducer` in a
  context. It is a small, well-defined state machine; a reducer makes it testable and makes
  URL serialisation trivial.
- **Graph state** (loading, ready, error, the worker handle) → `useSyncExternalStore` over the
  worker client. Correct under concurrent rendering, no extra dependency.
- **URL** is derived from route state on every commit and parsed back on boot. `URLSearchParams`,
  no router.

**⚠ Decision needed:** if the reducer exceeds ~200 lines, revisit and consider Zustand (2.9 KB).
Not a UI library, so C1 permits it. Start without it.

---

## 5. Library choices

### Adopt

| Package | Why | Budget |
|---|---|---|
| `react` + `react-dom` 19 | C4. | 45 KB br |
| `typescript` 5.x, `strict: true` | C4. `noUncheckedIndexedAccess` on — the engine indexes arrays constantly. | 0 |
| `vite` (via `@nx/vite`) | Fast dev, native Worker + WASM support, first-class Nx integration. | 0 |
| `leaflet` 1.9 — **from npm, not unpkg** | C3. Removes the CDN SPOF and the missing-SRI finding (P3). | 42 KB br |
| `vitest` | Same transform pipeline as Vite. The engine tests are pure functions — this is where coverage goes. | 0 |
| `@testing-library/react` | Component tests without a UI library's test utils. | 0 |
| `playwright` | Three e2e smoke tests, no more (§9). | 0 |
| `biome` | Lint + format in one tool, ~20× faster than ESLint+Prettier, zero plugin config. | 0 |
| Python: `numpy`, `Pillow` | Packing and tiling. Pipeline only, never shipped. | 0 |

### Reject, and why

| Rejected | Reason |
|---|---|
| Any UI component library | **C1.** The entire UI is one floating panel, a list, and a few buttons. |
| Tailwind | C1. CSS Modules + custom properties already give scoping and theming with no build plugin. |
| `react-leaflet` | Wraps Leaflet's imperative model in JSX and then leaks it back out through refs. The bridge in §4.3 is ~150 lines and we control it. |
| `react-router` | One page. `URLSearchParams` and the History API are the whole requirement. |
| Redux / Zustand *(for now)* | §4.4. Revisit if the reducer grows. |
| `i18next` | 40 KB for two languages and ~80 strings. A typed dictionary is 40 lines and gives better autocomplete. |
| `d3` | The elevation chart is one `<path>` from an array of `z` values. `d3-shape` alone if it gets hard. |
| A routing API / backend service | §3.1. Slower and more expensive than doing it locally. |
| WASM for A\* | Measured 31 ms in JS. CSR + a stale-pop guard gets it to ~15 ms. Revisit only if a profile says so. |
| `comlink` | The worker protocol is three messages. A typed `postMessage` wrapper is ~50 lines and keeps the types honest. |

**Total runtime JS budget: < 120 KB brotli**, excluding the graph payload.

---

## 6. The data pipeline

### 6.1 What it produces

```
tools/pipeline/  (Python)
  extract_nodes.py    NODES.DAT ──────────► sanandreas.sapg      ~602 KB   (§6.2)
  build_tiles.py      144 × .txd ─────────► tiles/{z}/{x}/{y}.webp         (§6.4)
  build_pois.py       curated + IPL/IDE ──► pois.json            ~40 KB    (§6.5)
  verify.py           all of the above ───► invariant report               (§6.6)
```

Run via Nx targets so `nx run pipeline:build` works the same as any JS target. Use
`nx:run-commands` initially; adopt `@nxlv/python` only if the pipeline grows past three scripts.

### 6.2 The `.sapg` binary format

Normative definition lives in `docs/graph-format.md`. Summary:

**Structure of Arrays + CSR adjacency**, little-endian throughout. Not an array of node objects —
the whole point is that the worker can `new Float32Array(buffer, offset, n)` with zero parsing and
zero per-node allocation.

```
Header — 32 bytes
  0   u8[4]   magic          "SAPG"
  4   u16     version        1
  6   u16     flags          bit0: adjacency is symmetric (undirected)
  8   u32     nodeCount      N
  12  u32     edgeCount      E   (directed entries in the CSR = 2 × undirected pairs)
  16  u16     componentCount C
  18  u16     maxSpeedKmh        ← P1-4: the heuristic derives its ceiling from THIS, not a literal
  20  u8[12]  reserved (zero)

Body — every section 4-byte aligned
  f32[N]    x
  f32[N]    y
  f32[N]    z
  u16[N]    componentId        ← precomputed at build time. Kills P0-2 at zero runtime cost.
  u8[N]     areaId             ← lets scope selection be a filter, not a second dataset (§6.3)
  u32[N+1]  adjOffset          ← CSR row pointers
  u32[E]    adjTarget          ← CSR column indices
  u8[E]     adjSpeedKmh
```

Measured sizes for the full network (N=28,991, E=59,620):

| | Raw | Over the wire (brotli) |
|---|---|---|
| Current JSON | 5.52 MB | ~1.2 MB |
| `.sapg` | **818 KB** | **~450 KB** |

Rationale for each field:

- **`componentId` precomputed.** P0-2 is the worst user-facing bug and it disappears entirely if
  the snap function can ask "is this node in the giant component?" in O(1). Computing it at build
  time costs 29 KB and saves ~10 ms of union-find on every load.
- **`maxSpeedKmh` in the header.** P1-4 — the heuristic's admissibility bound stops being a magic
  `130` in the source and becomes a value derived from the data it is used with. The reader asserts
  it on load.
- **`areaId`.** See §6.3.
- **CSR instead of `Map<string, Edge[]>`.** The current graph allocates 28,991 strings, 28,991 node
  objects, 28,991 arrays and 59,620 edge objects. CSR is four typed arrays. This is where the 147 ms
  build time goes to near zero.
- **No `dist` field.** P1-2 — it was in the JSON and never read. 3D distance is recomputed from
  coordinates, which is both smaller and always consistent with `z`.
- **No node ids.** Ids become array indices. `areaId` + index reconstructs the original `16_0` form
  if anything ever needs it.

**⚠ Decision needed:** whether to ship `.sapg` gzipped-at-rest or rely on the CDN's brotli. Vercel
brotlis automatically; committing a pre-compressed file complicates the pipeline for no gain.
Recommendation: rely on the CDN.

### 6.3 Kill the San Fierro subset file

`data/san_fierro_official_nodes.json` should be **deleted**, not migrated.

It exists to make the app feel faster on one city, and it costs: 1.09 MB of duplicated data, a
second code path, the hardcoded-and-wrong "6,217 nodes" label (P3), the whole of P0-1, and a dataset
where **19.7% of nodes are unroutable** because cutting by area severed every cross-boundary edge.

With `areaId` in the header, "San Fierro" becomes a **view filter over the full graph**: the camera
flies to SF and the debug layer filters by area, but routing always runs on the complete network. One
dataset, one code path, no orphaned components, and routes that leave the city still work.

### 6.4 Map tiles

The 6144×6144 WebP is 1.39 MB and is fetched in full before anything is visible, at every zoom
level. Slice it into a standard `{z}/{x}/{y}` pyramid (levels 0–5, 256 px tiles) and Leaflet's
`L.tileLayer` handles the rest natively. First paint fetches ~6 tiles instead of 1.39 MB.

Keep the single WebP as the level-0 fallback.

### 6.5 Place names — the missing dataset

**There are zero names in the road graph.** Search-by-name (§7.2), the headline product feature,
needs a dataset that does not exist yet. Three sources, in order of effort:

1. **`data/san_fierro_nodes.json`** — the orphaned legacy file (P3). ~30 hand-written, correctly
   placed, Spanish-named landmarks (`"Gant Bridge Norte"`, `"Battery Point / Club Jizzy"`). Harvest
   it *before* deleting the file.
2. **Curated list** — ~300 canonical locations (safehouses, businesses, mission markers, airports,
   districts) with world coordinates. This is manual work and it is the single highest-value
   content task in the project.
3. **Game files** — `american.gxt` for zone names, `.ipl` for object placements. Highest fidelity,
   most pipeline work. Phase 4 at the earliest.

Schema: `{ id, name: { en, es }, aliases: string[], x, y, z, kind, city }`. `aliases` matters —
people type "grove" and "ganton", not "Grove Street".

### 6.6 Pipeline invariants

`tools/verify-graph.mjs` already enforces these and runs in CI. It currently **fails** on the SF
subset, which is the correct outcome — see §6.3.

Every dataset must satisfy: unique ids · no dangling endpoints · no duplicate edges · no self-loops ·
all coordinates within [-3000, 3000] · finite `z` on every node · **giant component ≥ 90% of nodes**.

---

## 7. Feature specifications

### 7.1 Shareable routes (URL state)

Every route is a URL. This is the feature that makes the thing spread.

```
?w=2494,-1668;1707,-2438;-1980,130 &r=1 &v=car &l=es
  w  waypoints, world coords, semicolon-separated, no ids (ids change per dataset build)
  r  selected alternative index
  v  vehicle profile
  l  language
```

Rules: parse on boot before the graph loads (the URL is authoritative); write with
`history.replaceState` on every committed change, never on every drag frame; round coordinates to
integers; cap at 26 waypoints (the A–Z labels already assume this).

Acceptance: paste a URL into a fresh browser, get a pixel-identical route.

### 7.2 Search by name

Depends entirely on §6.5. A hand-written combobox in `libs/ui` (C1: no `react-select`,
no `cmdk` — this is ~120 lines including keyboard nav and ARIA).

Matching: case- and accent-insensitive prefix match over `name.{lang}` + `aliases`, ranked by
prefix-over-substring then by kind priority. 300 entries — no index, no fuzzy library; a linear
scan is sub-millisecond.

Acceptance: typing "aero" finds "Las Venturas Airport" via its `aeropuerto` alias. Full keyboard
operation. Announced to screen readers.

### 7.3 Vehicle profiles

The physics model exists (`libs/terrain`) but is hardcoded to one imaginary vehicle. Expose it:

| Profile | Nominal | Slope sensitivity | Notes |
|---|---|---|---|
| Car (default) | 100% | current curve | today's behaviour |
| Sports | 115% | more penalised on climbs | rewards highways |
| Bike | 90% | barely penalised | shortest-path-ish |
| Truck | 70% | heavily penalised | avoids Mt Chiliad entirely |
| Off-road | 80% | flat | ignores grade |

This also fixes P2-5's step function: replace the six-branch `if` chain with a continuous curve per
profile. Same shape, differentiable, no 25% cost cliff at exactly +4.01% grade.

Acceptance: Truck and Sports produce visibly different routes between Angel Pine and Los Santos.

### 7.4 Mobile

Currently unusable: a fixed 360 px panel over a map that needs a mouse and a hover-only coordinate
readout.

- Panel becomes a bottom sheet with three snap points (peek / half / full). Hand-written, CSS
  `scroll-snap` + pointer events. No `react-modal`, no `vaul`.
- Tap-to-add-waypoint with a confirmation step — a stray tap must not add a marker.
- Drop the hover coordinate readout on touch; it has no meaning there.
- Target: 375 px wide, one-handed, 44 px minimum touch targets.

### 7.5 i18n (ES / EN)

`libs/i18n`: a `const dict = { es: {...}, en: {...} } as const` and a `useTranslation()` hook.
`keyof typeof dict.en` gives compile-time key checking and autocomplete — better than i18next, at
40 lines.

Default from `navigator.language`, override via `?l=`, persist in `localStorage`. Spanish is the
primary audience; **`es` is the reference translation** and `en` follows it.

### 7.6 Route quality

Fixing what P2-6 identified, once the foundation is in place:

- Reject an alternative whose edge overlap with an already-accepted route exceeds 70%.
- Return `{ routes, requested, found }` so the UI can say "only 2 distinct routes exist" instead of
  silently showing fewer.
- Elevation profile chart: one inline `<svg><path>` from the `z` array. No chart library.
- Turn-by-turn directions: **[DEFERRED / SKIPPED for v1]** derive bearing changes along the path, cluster into manoeuvres ("continue 1.2 km", "turn right"). May be revisited in a future phase if community demand justifies it.

---

## 8. Implementation plan

Six phases. Each is independently shippable and leaves the app working. **Phase 0 happens on the
current vanilla code, before the migration** — porting known bugs into a new architecture just
launders them.

---

### Phase 0 — Stop the bleeding · ~1 day · vanilla JS

Fix the P0s and the free P1s where they are. No new architecture.

| Task | Finding |
|---|---|
| Re-snap all waypoints after any graph load | P0-1 |
| Union-find components at build; snap only into the giant component | P0-2 |
| Failed multi-stop legs render as failed; never folded into a total | P0-3 |
| Delete `?v=${Date.now()}` from the fetch | P1-1 |
| In-flight guard on `loadGraphData`; release `rawData` after build | P1-3 |
| Derive the heuristic ceiling from `max(edge.speed) × 1.10`; assert it | P1-4 |
| Stale-pop guard in the A\* loop | P1-6 |
| Fix the "6,217 nodes" label; fix `npm start` on Windows | P3 |

**Exit:** `node tools/verify-graph.mjs` passes on the full network. `node tools/bench-route.mjs`
shows no regression. Clicking any road anywhere on the map produces a route or an honest explanation.

---

### Phase 1 — Nx skeleton and the engine port · ~3 days

Set up the workspace and move the **pure** code first, because it ports without judgement calls.

- `nx init`, `apps/web` (Vite + React + TS strict), Biome, Vitest, Nx boundary tags (§4.2).
- Port `elevation-cost.js` → `libs/terrain` with types. **Write the tests it never had** — slope
  buckets, 3D distance, elevation profile, degenerate inputs.
- Port `pathfinder.js` → `libs/pathfinding`. `MinHeap`, spatial hash, A\*, alternatives. Tests
  including the admissibility assertion from P1-4.
- Port `map-config.js` → `libs/geo`.
- The old `index.html` still runs and still ships. Nothing user-visible changes.

**Exit:** `nx test pathfinding terrain geo` green, ≥90% coverage on those three. `nx bench` matches
Phase 0 timings.

---

### Phase 2 — Binary format and the worker · ~4 days

The performance phase. Everything here is measurable.

- `tools/pipeline/extract_nodes.py` → `.sapg` (§6.2). Format documented in `docs/graph-format.md`.
- `libs/graph-format` — TS reader. Validates magic, version, and `maxSpeedKmh`; builds typed-array
  views with zero copies.
- Rewrite `libs/pathfinding` against CSR typed arrays instead of `Map`s. Same public API, same
  tests, no `string` ids in the hot loop.
- `apps/web/src/worker` — graph worker + typed message protocol
  (`load` / `route` / `nearest` / `progress`). Transferable `ArrayBuffer`, no structured cloning of
  the graph.
- Tile pyramid (§6.4). Delete the SF subset (§6.3); scope becomes a view filter.

**Exit, as hard numbers:**

| Metric | Now | Target |
|---|---|---|
| Graph payload (wire) | ~1.2 MB | **< 500 KB** |
| Main-thread block at boot | 210 ms | **< 16 ms** |
| Time to interactive map | ~2.5 s | **< 1.5 s** on simulated 4G |
| Cross-state route | 31 ms | **< 20 ms** |

---

### Phase 3 — The React UI · ~5 days

Now, and only now, replace the DOM code — against an engine that is already correct and fast.

- `libs/map-bridge`: the Leaflet bridge (§4.3). The only `import 'leaflet'` in the repo.
- `libs/ui`: `Button`, `Panel`, `Field`, `Sheet`, `Combobox`, `Icon`. Hand-written (C1).
- `apps/web/src/features`: `map`, `waypoints`, `route-panel`, `settings`.
- Route reducer + URL state (§7.1).
- `libs/i18n`, ES + EN (§7.5).
- Delete `js/`, `css/style.css`, and the old `index.html`.

**Exit:** feature parity with Phase 0 plus shareable URLs and two languages. Zero `innerHTML` (P2-3).
Zero inline styles (P2-4). Lighthouse ≥ 95 on performance and accessibility.

---

### Phase 4 — The product features · ~5 days

- POI dataset (§6.5) — start harvesting `san_fierro_nodes.json` on day one.
- Search combobox (§7.2).
- Vehicle profiles (§7.3), including the continuous slope curve that retires P2-5.
- Mobile bottom sheet (§7.4).
- Elevation profile chart (§7.6). *(Turn-by-turn deferred to future).*

**Exit:** usable one-handed on a 375 px phone. Search finds any of the 300 POIs in ES or EN.

---

### Phase 5 — Optional · unscoped

Short links (§3.3, **⚠ decision needed**) · bidirectional A\* or ALT landmarks if profiling justifies
it · live frontier visualisation for the algorithm-curious · turn-by-turn navigation manoeuvres · PWA / offline · public train and flight
network layers.

---

## 9. Testing

Test the parts that are pure and the flows that would embarrass us. Nothing in between.

| Layer | Tool | Target | What |
|---|---|---|---|
| `libs/pathfinding`, `libs/terrain`, `libs/geo`, `libs/graph-format` | Vitest | **≥ 90%** | Where all the real coverage lives. These are pure functions with known-good outputs. |
| `libs/ui` | Vitest + Testing Library | smoke | Renders, keyboard nav, ARIA. |
| Features | Vitest + Testing Library | key flows | Reducer transitions, URL round-trip. |
| App | Playwright | **3 tests** | Add A + B → route appears · shared URL restores identically · mobile sheet opens and routes. |
| Datasets | `verify-graph.mjs` | invariants | Runs in CI on every push (§6.6). |
| Performance | `bench-route.mjs --json` | regression | Fails CI if any median regresses > 20%. |

Two non-obvious tests that matter more than their size suggests:

1. **Heuristic admissibility** — for a random sample of edges, assert
   `heuristic(a, b) ≤ actualCost(a, b)`. This is the invariant whose violation is invisible (P1-4).
2. **`.sapg` round-trip** — Python writes, TypeScript reads, values match. The format is a contract
   between two languages and nothing else checks it.

---

## 10. Performance budgets

Enforced in CI. A PR that breaks one of these fails.

| Budget | Limit |
|---|---|
| JS bundle (brotli, excl. graph) | 120 KB |
| Graph payload (wire) | 500 KB |
| Longest main-thread task at boot | 50 ms |
| Time to interactive (simulated 4G, mid-tier mobile) | 1.5 s |
| Route recomputation p95 | 20 ms |
| Marker drag → repaint | 1 frame (16 ms) |

---

## 11. Open decisions

| # | Question | Recommendation |
|---|---|---|
| D1 | Are Phase 5 short links in scope? (§3.3) | **No** for v1. Full URL state covers it without a server. |
| D2 | `@nxlv/python` or plain `nx:run-commands` for the pipeline? (§6.1) | `run-commands` until the pipeline exceeds three scripts. |
| D3 | Ship `.sapg` pre-compressed or rely on CDN brotli? (§6.2) | CDN. Vercel brotlis automatically. |
| D4 | Zustand if the route reducer grows past ~200 lines? (§4.4) | Start without. Revisit with real code, not in advance. |
| D5 | Are GTA units labelled as metres, or as "units"? (P2-5) | Keep "km" and "min" — the audience thinks in game distances — but state the assumption in an info tooltip. |
| D6 | Repo language: docs and code in English, UI in ES + EN? | Yes. Matches commit `2d7cbd4` and keeps the codebase contributable. |
| D7 | Do we commit `.sapg` to git, or build it in CI? | Commit it. 818 KB, changes maybe twice a year, and it keeps `git clone && nx serve` working without Python. |

---

## 12. Effort

| Phase | Days | Cumulative |
|---|---|---|
| 0 · Stop the bleeding | 1 | 1 |
| 1 · Nx + engine port | 3 | 4 |
| 2 · Binary + worker | 4 | 8 |
| 3 · React UI | 5 | 13 |
| 4 · Product features | 5 | 18 |

**~18 focused days to the target in §1.** Phases 0–2 are the ones with hard numbers attached, and
they are the ones that make everything after them cheap.
