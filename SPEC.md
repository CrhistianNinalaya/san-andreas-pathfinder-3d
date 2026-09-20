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

### 3.3 Two features need a runtime service — later

**Short links for shared routes.** A route with 8 waypoints encodes to ~120 characters in a URL,
which is fine for a Discord paste but ugly. If we want `sapf.app/r/x7k2m`, we need persistence.

That is **one serverless function plus a KV store** (Vercel Functions + Vercel KV, or Cloudflare
Workers + KV). Not a service, not a database, no auth. Deferred to Phase 5 and explicitly optional —
Phase 3 ships full URL state without it.

**Community route listing and voting (§7.9.5).** Browsing routes other players uploaded, and ranking
them by votes or usage, is shared state by definition — `localStorage` cannot express it. This is the
feature that actually forces the question this section deferred, and unlike short links it is not
cosmetic: it is the difference between a contribution loop and a private import tool.

It lands on the same infrastructure (one edge function + KV) but carries problems short links do not:
abuse, a moderation queue, rate limiting, and a privacy surface. §7.9.5 therefore stages it —
export-and-send first (no infrastructure at all), then a submit-only webhook, and the public listing
last, as its own scoped phase. **Promotion into the curated set stays manual at every stage.**

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

### 4.1 Project Layout (Pure Domain Architecture — Supersedes Nx)

> [!NOTE]
> **Architecture Decision:** The original proposal suggested an Nx monorepo (`apps/web` and `libs/*`).
> This was evaluated and superseded by a cleaner **Pure Domain Directory Architecture** under standard
> Vite + TypeScript + `pnpm`. This avoids Nx daemon/workspace configuration overhead while fully
> guaranteeing the exact same domain purity and zero-DOM isolation invariants.

```
san-andreas-pathfinder-3d/
├── src/
│   ├── engine/                     ★ pure domain. A*, MinHeap, CSR-like graph, types.
│   │                               Zero imports of React, Leaflet, or DOM. 100% unit-tested.
│   ├── terrain/                    ★ pure domain. Elevation physics, continuous slope curve, vehicle profiles.
│   ├── geo/                        ★ coordinate systems. GTA world ↔ Leaflet ↔ image pixels.
│   ├── map-bridge/                 Leaflet ↔ React Bridge. The ONLY place that imports leaflet.
│   ├── features/                   Route state, URL state sync, search combobox.
│   ├── components/                 Hand-written UI components (MapCanvas, NavigationPanel, MapLegend, etc.).
│   ├── ui/                         Global CSS tokens, breakpoints, resets. No third-party UI libraries (C1).
│   ├── i18n/                       Typed bilingual dictionaries (ES/EN) + useTranslation hook.
│   └── app/                        Root application container.
│
├── public/data/
│   ├── official/                   san_andreas_official_nodes.json (extracted from GTA:SA NODES.DAT).
│   ├── custom/                     custom_network.json (patches) and shortcuts/*.json.
│   └── pois.json                   Point of interest catalog with bilingual names.
│
├── tools/
│   ├── verify-graph.ts             Graph validation and connectivity invariant suite.
│   ├── bench-route.ts              A* performance benchmark against fixed OD pairs.
│   └── import-shortcuts.ts         CLEO shortcut importer and normalization script.
│
├── docs/                           Architecture reviews and specifications.
└── .agent/                         Skills and workflows for AI pair programming.
```

★ = no dependency on React, Leaflet, or the DOM. These are pure modules where unit tests run with Vitest.

### 4.2 Enforced dependency rules

Enforced as a hard invariant in `AGENTS.md` and checked at build/test time:

```
src/app, src/components  →  may import  src/features, src/ui, src/i18n, src/engine, src/map-bridge
src/map-bridge           →  may import  src/geo, src/engine, src/i18n  (and leaflet)
src/features             →  may import  src/engine, src/terrain, src/i18n
src/ui                   →  may import  nothing
src/engine               →  ★ pure domain (ZERO imports of React, Leaflet, or DOM)
src/terrain              →  ★ pure domain (ZERO imports of React, Leaflet, or DOM)
src/geo                  →  ★ pure domain (ZERO imports of React, Leaflet, or DOM)
```

The governing rule: **`src/engine/`, `src/terrain/`, and `src/geo/` have zero imports of React, Leaflet, or the DOM.** That
single constraint is what makes the engine testable, worker-safe, and completely portable.

### 4.2.1 Folder Conventions: `hooks/` and `utils/`

To keep UI lifecycle orchestration completely separate from business and mathematical logic:

1. **Pure Functions strictly live in `utils/` (never inline inside hooks):**
   - Pure calculations, data parsers, query formatters, geometry filters, and coordinate transforms must live in dedicated files under `utils/`.
   - **Grouping Subfolders:** If a feature or module contains multiple related utility files, group them inside a dedicated subfolder within `utils/` (e.g., `src/map-bridge/utils/node-layer/...` or `src/features/route/utils/url/...`).
   - **Colocated Unit Tests:** Every utility or domain file must have its corresponding unit test file colocated as a sibling right next to it (`[name].test.ts`). Never create dedicated `__tests__/` folders.
2. **React Hooks strictly live in `hooks/`:**
   - Component-specific hooks live in `src/components/[ComponentName]/hooks/`.
   - Feature-specific hooks live in `src/features/[featureName]/hooks/`.
   - Shared cross-cutting hooks live in `src/hooks/` or `src/[module]/hooks/`.
   - Hooks must strictly orchestrate state and side effects, importing and delegating pure transformations to `utils/`.
    - **Zero Auxiliary Functions:** A hook file must strictly and exclusively contain the hook declaration and its props/options interface. Zero helper functions, subroutines, pure calculations, or renderers are permitted inside hook files; all must be delegated to dedicated files in `utils/`.

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
  build_pois.py       curated + IPL/IDE ──► pois.json            ~40 KB    (§6.5, §7.11.1)
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

### 7.1 Shareable routes (URL state) — [COMPLETED]

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

### 7.2 Search by name — [COMPLETED]

Depends entirely on §6.5. A hand-written combobox in `libs/ui` (C1: no `react-select`,
no `cmdk` — this is ~120 lines including keyboard nav and ARIA).

Matching: case- and accent-insensitive prefix match over `name.{lang}` + `aliases`, ranked by
prefix-over-substring then by kind priority. 300 entries — no index, no fuzzy library; a linear
scan is sub-millisecond.

Acceptance: typing "aero" finds "Las Venturas Airport" via its `aeropuerto` alias. Full keyboard
operation. Announced to screen readers.

### 7.3 Vehicle profiles — [COMPLETED]

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

### 7.4 Mobile — [COMPLETED]

Currently unusable: a fixed 360 px panel over a map that needs a mouse and a hover-only coordinate
readout.

- Panel becomes a bottom sheet with three snap points (peek / half / full). Hand-written, CSS
  `scroll-snap` + pointer events. No `react-modal`, no `vaul`.
- Tap-to-add-waypoint with a confirmation step — a stray tap must not add a marker.
- Drop the hover coordinate readout on touch; it has no meaning there.
- Target: 375 px wide, one-handed, 44 px minimum touch targets.

### 7.5 i18n (ES / EN) — [COMPLETED]

`libs/i18n`: a `const dict = { es: {...}, en: {...} } as const` and a `useTranslation()` hook.
`keyof typeof dict.en` gives compile-time key checking and autocomplete — better than i18next, at
40 lines.

Default from `navigator.language`, override via `?l=`, persist in `localStorage`. Spanish is the
primary audience; **`es` is the reference translation** and `en` follows it.

### 7.6 Route quality — [COMPLETED]

Fixing what P2-6 identified, once the foundation is in place:

- Reject an alternative whose edge overlap with an already-accepted route exceeds 70%.
- Return `{ routes, requested, found }` so the UI can say "only 2 distinct routes exist" instead of
  silently showing fewer.
- Elevation profile chart: one inline `<svg><path>` from the `z` array. No chart library.
- Turn-by-turn directions: **[DEFERRED / SKIPPED for v1]** derive bearing changes along the path, cluster into manoeuvres ("continue 1.2 km", "turn right"). May be revisited in a future phase if community demand justifies it.

### 7.7 Custom Markers & SA-MP Roleplay Circuits (FenixZone / Job Presets)

Target use-case: SA-MP / GTA:SA multiplayer roleplay circuits that require purchasing or delivering goods across multiple map points (e.g., FenixZone *Armero* job requiring 250 materials in San Fierro, 50 at Los Santos Ammu-Nation, and 50 at the Los Santos storm drain/canal).

#### 7.7.1 Persistent Custom Markers (Local POIs)
- **Creation:** Right-click on map canvas, long-press on mobile, or "Save Pin" action from current coordinate tracker.
- **Attributes:**
  ```typescript
  interface CustomMarker {
    id: string; // crypto.randomUUID() or timestamp
    name: string; // e.g. "Fábrica Materiales SF", "Desagüe 50 Mats"
    x: number;
    y: number;
    z: number;
    category?: 'materials' | 'ammunition' | 'job' | 'safehouse' | 'custom';
    color?: string; // hex accent or token
    createdAt: number;
  }
  ```
- **Storage:** Persisted locally in `localStorage` under `sap_custom_markers`.
- **Search Integration:** Injected into `SearchCombobox` queries alongside official POIs with an indicator badge (`[Favorito]` / `[Custom]`).
- **Map Layer:** Rendered with distinct customizable Leaflet marker icons with quick "Añadir a ruta" popup action.

#### 7.7.2 Saved Route Presets (Circuit Templates)
- Save active multi-stop waypoint sequences as reusable named presets (e.g. `"Ruta Armero 350 Mats"`, `"Circuito Basurero / Repartidor"`).
- **Schema:**
  ```typescript
  interface RoutePreset {
    id: string;
    title: string;
    description?: string;
    vehicleType: VehicleProfileType;
    waypoints: Array<{ name: string; x: number; y: number; z: number }>;
    updatedAt: number;
  }
  ```
- **UI Management:** Quick preset dropdown / modal in the navigation panel to load, rename, reorder, or delete saved circuits in 1 click.

#### 7.7.3 TSP Circuit Optimizer (*Travelling Salesperson Problem*)
- Multi-stop optimization button: **"⚡ Optimizar orden de paradas"**.
- For $\le 8$ waypoints, computes optimal permutation of intermediate stops (preserving Origin and/or Final Destination) using brute-force / Held-Karp over A* cost matrix to minimize total travel time.

#### 7.7.4 Import / Export & Shareable Links
- Export custom markers and presets to portable `.json` files to share with gang members or friends.
- URL Hash serialization (e.g. `#circuit=SF_Mats,LS_Ammu,LS_Drain`) for one-click sharing in Discord / forums.

### 7.8 Shortcut & Offroad Network (SA-MP Wildcard Edges & Cliff Jumps) — [COMPLETED]

Official GTA:SA node datasets only contain paths coded by Rockstar for ambient NPC traffic on paved roads. Real multiplayer/SA-MP roleplay drivers (e.g. FenixZone) use off-road hill cuts, cliff jumps, railroad bridges, and stormwater drains to bypass long highway curves.

#### 7.8.1 Shortcut Edge Data Model
```typescript
interface ShortcutEdge {
  id: string;
  name: string; // e.g. "Salto Risco Flint County", "Atajo Césped Vinewood"
  fromCoords: GtaCoords;
  toCoords: GtaCoords;
  type: 'offroad' | 'cliff_jump' | 'railroad' | 'drainage' | 'urban_cut';
  isUnidirectional: boolean; // Cliff jumps are strictly one-way (downhill only)
  nominalSpeed: number; // e.g. 40 km/h for rough dirt, 110 km/h for cliff drop
  dangerLevel: 1 | 2 | 3; // 1 = easy grass cut, 3 = high rollover/damage risk
  vehicleSuitability?: VehicleProfileType[]; // e.g. ['offroad', 'bike', 'sports']
}
```

#### 7.8.2 Routing Behavior & Visual Representation
- **Toggle Control:** `[⚡ Permitir atajos y saltos arriesgados (Rutas SA-MP)]`.
- **Hybrid Graph Insertion:** When enabled, shortcut edges are dynamically injected into `adjacencyList` linking nearest road nodes.
- **Visual Distinction:** Standard road segments render in cyan (`#38bdf8`), while shortcut/cliff segments render in vivid orange/red neon (`#f97316` / `#ef4444`) with hazard badges (⚠️ *Salto de Risco*).

#### 7.8.3 Data Acquisition Strategies (How to Capture Shortcut Coordinates)

Since off-road shortcuts and stunt jumps are emergent player knowledge not present in official traffic files, the data can be harvested through four complementary channels:

1. **In-Game CLEO / SA-MP GPS Logger Script (`tools/cleo/shortcut_recorder.cs`):**
   - A lightweight CLEO script running in GTA:SA / SA-MP with keyboard hotkeys:
     - `Ctrl + 1` at the edge of the cliff (captures `start: { x, y, z }`).
     - `Ctrl + 2` at the landing road (captures `end: { x, y, z }` and saves to `shortcuts_dump.json`).
     - **Breadcrumb recorder mode:** Records coordinates every 10 metres while driving off-road to capture curved paths.
2. **Visual Web Editor Mode (*In-App Shortcut Builder*):**
   - An interactive editor mode in the web app: click node A on the high-res satellite Leaflet canvas, click node B, configure jump type/one-way flag, and save directly to `localStorage` or download as `shortcuts.json`.
3. **Automated Extraction of `tracks.dat` (Railroad Network):**
   - Extract train tracks from GTA `data/paths/tracks.dat` via a Python script (`tools/pipeline/extract_tracks.py`) to automatically generate railroad bridge and tunnel shortcut corridors.
4. **Community Datasets & Crowdsourcing:**
   - Shipped as a curated `data/shortcuts.json` in the repository, open to community PRs for roleplay servers.

### 7.9 Community Route Contributions

§7.8.3 lists four ways to acquire shortcut geometry. This section specifies the one that scales:
players record their own trajectories with the CLEO recorder and load them into the app themselves.

The governing constraint, established while curating the six shipped shortcuts: **a recording
session produces takes, not results.** The player crashes, misses the cliff jump, or simply drives a
worse line, and all of those produce a perfectly well-formed trajectory — monotone point indices,
~10 m spacing, valid coordinates. Nothing in the geometry separates a clean run from a botched one.
So a contributed route is always a *candidate*, never publishable data, and promotion into
`public/data/custom/shortcuts/` stays a human decision.

#### 7.9.1 In-browser INI import

`tools/import-shortcuts.ts` parses `shortcuts.ini` today, but is coupled to `node:fs`. Extract the
pure parser to `src/engine/parseShortcutsIni.ts`, mirroring what `src/engine/loadNetwork.ts` did for
the three-layer merge — one implementation, two callers (CLI and browser).

- **Entry point:** drag a `shortcuts.ini` onto the map, or a file picker. No upload; the file is read
  with `FileReader` and never leaves the browser at this stage.
- **Output:** one `UserRoute` per `[<id>]` section that survives validation (§7.9.3).
- **Graph integration:** a **fourth layer**. `mergeCustomLayers` already composes patches + curated
  shortcuts; it takes a third source. `RoadGraph` rebuilds in ~60 ms measured, so recomputing on
  every import is viable without a loading state.

#### 7.9.2 Node adjustment by drag — and the Z problem

A raw recording sits where the *vehicle* was, not where the road *centreline* is. The curation skill
quantifies the systematic offset at **5–7 m** perpendicular to the road axis, because players drive
inside their lane. So contributors need to nudge nodes, and dragging on a 2D map is the natural
gesture.

**Dragging moves X and Y. It cannot produce Z.** That is the whole design problem here, and the
model below exists to keep the error visible rather than to pretend it away.

```typescript
interface UserRouteNode {
  id: string;
  /** Exactly as the CLEO recorder wrote it. Never mutated, ever. */
  recorded: GtaCoords;
  /** Current position after manual adjustment. */
  current: GtaCoords;
  zSource: 'recorded' | 'inferred';
}
```

`recorded` is immutable so drift is always measurable against ground truth and any adjustment can be
reverted to the original reading.

**Drift is reported as an estimated Z error, not as a distance.** A 12 m drag along a flat highway is
harmless; the same drag across a hillside invalidates the altitude. The app already has the means to
tell the difference — `ElevationPhysics.calculateSlope` over the node's neighbours:

```typescript
interface NodeDrift {
  /** Metres between recorded and current X/Y. */
  horizontal: number;
  /** horizontal x |local slope|, from the segments either side of the node. */
  estimatedZError: number;
  severity: 'none' | 'caution' | 'high';
}
```

| Severity | Trigger | UI |
|---|---|---|
| `none` | `horizontal <= 6 m` | no marker; this is lane-offset correction, the expected use |
| `caution` | `horizontal <= 15 m` **or** `estimatedZError <= 1.5 m` | amber dot on the node, tooltip on hover |
| `high` | beyond either | amber outline on the whole route, tooltip shown while dragging |

Tooltip copy comes from the i18n dictionary (§7.5) and interpolates the real figure rather than
showing a generic warning — e.g. *"moved 18 m from where CLEO recorded it · estimated altitude error
≈ 3.2 m"*.

**Hard cap: 40 m.** Past that the node is not being adjusted, it is being invented; the app refuses
the drag and suggests re-recording the segment. 40 m is chosen against the measured network: the
median official edge is **11.26 m**, so 40 m is roughly three nodes' worth of road — far enough that
the point no longer describes the same place.

**Marking directly on the map**, with no recording behind it, is permitted for standalone points but
yields `zSource: 'inferred'`: Z is copied from the nearest official node. This is acceptable exactly
where the surface is flat and well covered by the road network — the gas-station case in §7.11 — and
is **not** acceptable for cliff jumps, bridges or overpasses, where a recorded Z must be required.

#### 7.9.3 Validation before a user route touches the graph

The guards `tools/import-shortcuts.ts` grew are not CLI conveniences; they are what keeps an
uncurated recording from corrupting routing. All of them run in the browser, on import and again
after any drag:

| Check | Rejects |
|---|---|
| Finite coordinates | `1.#QNAN` / `-1.#IND` written during a load screen |
| At least 2 usable points | a burnt recording ID |
| Snap radius <= 60 m **and** abs(dz) <= 6 m | connectors that attach to the road *underneath* an overpass |
| `MAX_CLIMBABLE_SLOPE = 0.5` on non-`oneWay` routes | reverse edges up a cliff face, which A\* prices cheaply and therefore prefers |
| No dangling endpoints | an edge left pointing at a trimmed node |
| No id collision with the official or curated layers | a custom node silently replacing an official one |
| Weak giant == strongly-connected core | a route connected at one end only |

The last one is the subtle case and the reason this list is not optional. A user route with only an
exit connector still joins the weak giant, so `findNearestNode({ onlyGiant: true })` returns its
nodes while `findShortestPath` returns `null` — the app tells the user a point is on the network and
then cannot route to it.

**A failed check never silently drops the route.** The importer's lesson applies: name the node and
the rule, and let the contributor fix it by dragging.

#### 7.9.4 Local persistence and export

- **Storage:** `localStorage` under `sap_user_routes` for the MVP. A 116-node route is ~30 KB of
  pretty JSON against a ~5 MB per-origin quota, so dozens of routes fit. **Migrate to IndexedDB**
  past ~50 routes, or when binary geometry lands (§6.2).
- **Limits stated in the UI:** per browser, per device, lost when site data is cleared. This is why
  export exists.
- **Export:** emits the same document shape `import-shortcuts.ts` produces, so a contributed file
  drops straight into the curation workflow.

#### 7.9.5 Submission, moderation and promotion

**⚠ This is the feature that settles §3.3.** Route computation stays client-side and that verdict
does not change. But "see what the community uploaded" and "recommend popular routes" are shared
state: they cannot live in `localStorage` by definition.

Three options, in increasing cost:

| | Infrastructure | Gets you |
|---|---|---|
| **A · Export and send** | none | contributors download JSON and post it to Discord or open a PR. Promotion is already manual, so this works on day one. |
| **B · Submit-only endpoint** | 1 edge function + webhook | a "Submit" button that posts the route to a Discord channel or opens a GitHub issue. No public listing, no votes. |
| **C · Listing and votes** | edge function + KV | the full feature: browse others' routes, upvote, usage counters. |

**Recommendation: ship A alongside §7.9.1–7.9.4, then B, and treat C as its own scoped phase.** A and
B deliver the contribution loop with zero moving parts. C introduces the problems A and B do not
have — abuse, a moderation queue, rate limiting, and a privacy surface (§7.9.6).

For C, the minimum shape:

```typescript
interface RouteSubmission {
  remoteId: string;
  title: string;
  author?: string;          // optional handle; never an account
  route: UserRoute;
  votes: number;
  usageCount: number;       // times loaded into a route by any user
  status: 'pending' | 'published' | 'rejected' | 'promoted';
  submittedAt: number;
}
```

- **Rate limit** submissions and votes per IP hash. No accounts, no auth — consistent with §3.
- **Nothing is public until reviewed.** `pending` is the default; an unreviewed route is never served
  to other users.
- **Promotion is manual and stays manual.** Votes and usage produce a *ranked queue for review*,
  never an automatic merge. A popular route is still a take somebody recorded, and §7.9's governing
  constraint does not stop applying because ten people liked it. Promotion means running the curation
  pass — trim endpoints, fix connectors, decide `oneWay` — and then committing into
  `public/data/custom/shortcuts/` with `--out-dir ... --force`.

#### 7.9.6 What a contributed route reveals

A trajectory is a record of where a specific player drove, with timing implied by the 10 m sampling.
Before option B or C ships:

- Submission is **explicit and per route**, never automatic and never a background sync.
- The optional author handle is free text. No account, no email, no identifier the app did not ask
  for.
- The UI says plainly that a submitted route becomes public if published.

---

### 7.10 Map Legend — [COMPLETED]

Floating road network legend card explaining node types and providing per-class visibility filters.
Implemented in `src/components/MapLegend/` and integrated into the map canvas.

#### 7.10.1 Contents

| Symbol | Meaning |
|---|---|
| Official node | Rockstar `NODES.DAT` traffic path |
| Curated shortcut node | one of the six shipped routes, in that route's colour |
| User route node | imported locally, not published (§7.9) |
| Node with drift | adjusted beyond `caution` (§7.9.2) |
| Patch edge | manual repair of the official network (`custom_network.json`) |
| POI by `kind` | `landmark`, `safehouse`, `transport`, `hospital`, `military`, plus `gas` / `store` from §7.11 |
| Origin / destination / waypoint | route endpoints |
| Coincident node | the 7 measured positions holding two nodes; diagnostic toggle, off by default |

- Collapsible panel, collapsed by default on mobile (§7.4).
- Every entry is a **filter toggle**, not just a caption — clicking hides that class of geometry.
  This is the cheapest possible version of an "avoid shortcuts" control, reusing `type` and `oneWay`,
  which are already on every edge.

#### 7.10.2 Prerequisite — labels must come from the dictionary — [COMPLETED]

Shortcut datasets normalized to structured fields (`shortcutId`, `pointIndex`, `totalPoints`, `colorToken`)
and English default names. Node labels are rendered dynamically using typed i18n dictionary keys in `src/i18n/translations.ts`.

---

### 7.11 Fuel and Autonomy (SA-MP mode)

**⚠ Scope caveat, stated up front:** vanilla GTA:SA has **no fuel system** — vehicles never run dry.
Fuel is a SA-MP server script. So this is explicitly a *server mode*, its consumption constants are a
convention we choose rather than a fact extracted from the game, and it ships behind a toggle that is
off by default.

#### 7.11.1 The station dataset is the work

`public/data/pois.json` holds **14 entries** today: 6 `landmark`, 3 `safehouse`, 3 `transport`,
1 `hospital`, 1 `military`. **Zero fuel stations, zero stores.** No amount of routing logic
substitutes for this dataset, and it is also what §7.7's job circuits need.

New `kind` values: `gas`, `store` (24/7, Cluckin' Bell, pizzeria), `ammunation`.

**Z is not worth measuring per station.** Snap each station to its nearest official road node and
take that node's Z. The graph can only reach a station through a road node anyway, so a station's own
altitude never enters a cost calculation — only its position does, to pick the snap. Marking stations
by clicking the map (§7.9.2, `zSource: 'inferred'`) is therefore sufficient here, and this is the
case that justifies allowing inferred Z at all.

```typescript
interface FuelPoi {
  id: string;
  name: { en: string; es: string };   // matching the existing pois.json shape
  kind: 'gas' | 'store' | 'ammunation';
  x: number; y: number; z: number;
  /** Official node the router actually uses to reach it. */
  snapNodeId: string;
  city: string;
}
```

#### 7.11.2 Consumption model

Reuse `ElevationPhysics` rather than inventing a second physics module. Uphill already reduces the
speed response; the same response drives consumption, so climbing costs fuel per kilometre in the
same proportion it costs time.

```
litresPerKm(segment) = baseRate(vehicleProfile) / getSlopeResponse(slope, slopeSensitivity)
```

`baseRate` is one constant per `VehicleProfileType`. The five profiles already differ in
`nominalMultiplier` and `slopeSensitivity`, so the fuel model inherits vehicle differentiation for
free.

#### 7.11.3 Two tiers, ship the first

**Tier 1 — advisory post-pass. No change to A\*.** Route as normal, then walk the resulting polyline
accumulating consumption, and mark the point where the tank would run dry plus the last reachable
station before it. Renders as a marker on the route and a band on the existing elevation chart
(§7.6). This is a loop over an array the app already has.

**Tier 2 — refuel stops as waypoints.** When Tier 1 finds the route unreachable, insert the chosen
station into the waypoint list and re-route. `computeRoutes` already handles multi-stop trips and
already fails the whole trip on an unroutable leg, so this is largely UI. Ordering is then handled by
the TSP optimizer already specified in §7.7.3 — a refuel stop is an intermediate stop like any other.

**Not specified: range-constrained A\*.** Treating fuel as a resource dimension inside the search
multiplies the state space by the tank granularity. Tiers 1 and 2 answer the actual question ("where
do I refuel on this run?") at a fraction of the cost. Revisit only if a concrete route is found that
tiers 1 and 2 get wrong.

#### 7.11.4 Job circuits

The motivating case — gun-part runs and burglary routes touching pizzerias, 24/7s and gas stations —
is §7.7.2 (route presets) plus §7.7.3 (TSP) plus this section's dataset. No new routing machinery:
select a set of POI categories, the optimizer orders them, and the fuel pass says whether that order
is drivable on one tank.

---

### 7.12 Stunt Jump Catalogue

The 70 unique stunt jumps are a natural companion to the shortcut layer and share its data model
(§7.8.1, `type: 'cliff_jump'`, `isUnidirectional: true`).

**Priority: low, and honestly so.** Stunt jumps are a completionist feature; they do not help anyone
find a better route for a server job, which is what every other section here exists for. Specified so
the data model does not have to change later, scheduled last.

**Explicitly out of scope: collectibles.** Tags, snapshots, horseshoes and oysters are single-player
completion content. This tool targets SA-MP server play, where they do not exist.

---

## 8. Implementation plan

Six phases. Each is independently shippable and leaves the app working. **Phase 0 happens on the
current vanilla code, before the migration** — porting known bugs into a new architecture just
launders them.

---

### Phase 0 — Stop the bleeding · ~1 day · vanilla JS — [COMPLETED]

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

### Phase 1 — Engine port and pure domain · ~3 days — [COMPLETED]

Set up pure TypeScript domain separation and ported core algorithms with comprehensive unit tests:

- Pure domain layout: `src/engine/` (A*, MinHeap, graph connectivity), `src/terrain/` (ElevationPhysics, continuous slope cost), `src/geo/` (Leaflet/GTA coordinate conversion).
- Vitest unit test suite covering slope physics, 3D distances, heap operations, and A* route invariants (`pnpm test`).
- *Architecture Note:* Nx monorepo was evaluated and superseded by standard Vite + TypeScript directory isolation, avoiding unnecessary monorepo configuration overhead.

**Exit:** Vitest test suites green with 100% pure domain separation.

---

### Phase 2 — Binary format and the worker · ~4 days — [DEFERRED / OPTIONAL]

> [!NOTE]
> **Status Evaluation:** Deferred as optional performance enhancement.
> - **Wire payload:** Production HTTP compression (gzip/brotli) serves the merged 5.5MB JSON graph in ~700 KB on the wire.
> - **Execution speed:** A* route calculations execute in 5–18 ms on the main thread without frame drops.
> - **Worker scope:** Dedicated Web Worker execution is reserved for Phase 5 Item 8 (TSP multi-stop combinatorial solver) where CPU load justifies thread transfer.
> - Scope filter replaces the old San Fierro subset file.

---

### Phase 3 — The React UI · ~5 days — [COMPLETED]

Replace legacy DOM code with hand-written React 19 + TypeScript modules:

- `src/map-bridge/`: Imperative Leaflet bridge hooks (`useMapBridge`, `useRouteLayer`, `useWaypointMarkers`, `useNodesLayer`).
- Handcrafted UI with zero third-party component libraries (`Button`, `Panel`, `Sheet`, `Combobox`, `Cards`, CSS Modules).
- Navigation state machine with `useReducer` and shareable URL state (`useUrlState`).
- Bilingual typed dictionary (`src/i18n/translations.ts` ES/EN) with Spanish reference translation.
- Zero `innerHTML` and strict CSS design tokens from `src/ui/global.css`.

**Exit:** Feature parity with modern UI, shareable URLs, responsive layout, and bilingual support.

---

### Phase 4 — The product features · ~5 days — [COMPLETED]

- POI dataset catalog (`public/data/pois.json`).
- Accessible search combobox with prefix/substring matching and bilingual aliases.
- Vehicle physics profiles (`infernus`, `fcr900`, `sanchez`, `dumper`, `bike`) with continuous slope penalties.
- Mobile bottom sheet responsive layout (`@media (max-width: 768px)`).
- Interactive SVG elevation profile chart with gradient fill and cursor sync (`ElevationChart`).
- Turn-by-turn directions: Deferred for post-v1.

**Exit:** Full mobile and desktop usability, elevation chart rendering, and vehicle routing.

---

### Phase 5 — Community contributions and logistics · ~14 days

Scoped out of what was previously "optional · unscoped". Ordered by dependency, not by appeal: the
first two items unblock everything visual, and the POI dataset unblocks everything about fuel and
job circuits. Three of the four headline features here are **blocked on data, not on code.**

| # | Item | § | Days | Status | Blocks |
|---|---|---|---|---|---|
| 1 | Labels from the dictionary, not the data | 7.10.2 | 1 | **Completed** | the legend, and every user-facing string in 7.9 |
| 2 | Map legend with per-class filter toggles | 7.10 | 1 | **Completed** | — |
| 3 | Expanded POI dataset (`gas`, `store`, `ammunation`) | 7.11.1 | 2 | Pending | fuel, job circuits |
| 4 | Browser INI parser + fourth graph layer | 7.9.1 | 1.5 | Pending | all of 7.9 |
| 5 | Browser-side validation of contributed routes | 7.9.3 | 1 | Pending | must land with 4, not after |
| 6 | Drag adjustment, drift model, warning tooltip | 7.9.2 | 2 | Pending | — |
| 7 | Local persistence and export (option A) | 7.9.4 | 1 | Pending | the contribution loop, with zero infrastructure |
| 8 | TSP multi-stop optimizer | 7.7.3 | 1.5 | Pending | job circuits, refuel ordering |
| 9 | Fuel tiers 1 and 2 | 7.11.3 | 2 | Pending | — |
| 10 | PWA / offline | — | 1 | Pending | — |

**Items 4 and 5 ship together or not at all.** A browser import without the validation guards is a
way for any contributor to corrupt their own routing — an unclimbable reverse edge is cheap enough
for A\* to prefer, and a one-ended route is offered as a snap target that then fails to route.

**Exit:** a player records a trajectory in game, loads it in the browser, nudges it onto the road,
and routes through it — without a server, and without being able to break the shipped network.

---

### Phase 6 — Public route listing · unscoped, gated on D8

Option C of §7.9.5: the edge function, the KV store, votes, usage counters and the moderation queue.
Held separately because it is the only thing in this document that turns a static site into something
with an abuse surface and an operational cost. Options A and B in Phase 5 deliver the contribution
loop without any of it.

---

### Not scheduled

Short links (§3.3) · live frontier visualisation for the algorithm-curious · turn-by-turn navigation
manoeuvres (§7.6) · public train and flight network layers · stunt jump catalogue (§7.12, specified
but last).

**Explicitly rejected:** single-player collectible routing (§7.12). Wrong audience.

---

## 9. Testing

Test the parts that are pure and the flows that would embarrass us. Nothing in between.

| Layer | Tool | Target | What |
|---|---|---|---|
| `libs/pathfinding`, `libs/terrain`, `libs/geo`, `libs/graph-format` | Vitest | **≥ 90%** | Where all the real coverage lives. These are pure functions with known-good outputs. |
| `libs/ui` | Vitest + Testing Library | smoke | Renders, keyboard nav, ARIA. |
| Features | Vitest + Testing Library | key flows | Reducer transitions, URL round-trip. |
| App | Playwright | **3 tests** | Add A + B → route appears · shared URL restores identically · mobile sheet opens and routes. |
| Datasets | `pnpm verify-graph` | invariants | Per-file **and** merged three-layer graph. Runs in CI on every push (§6.6). |
| Performance | `pnpm bench --json` | regression | Fails CI if any median regresses > 20%. |

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
| D8 | Does the public route listing (§7.9.5 option C, Phase 6) ship at all? | **Not until options A and B have real contributors.** It is the only feature here that adds an abuse surface and a running cost. Build the loop first, then find out whether anyone uses it. |
| D9 | `localStorage` or IndexedDB for user routes? (§7.9.4) | `localStorage` for the MVP — ~30 KB per route against a ~5 MB quota. Migrate past ~50 routes, or when `.sapg` geometry lands. |
| D10 | Is a map-marked point with inferred Z ever acceptable? (§7.9.2) | Only where the road network is flat and dense — fuel stations (§7.11.1). Never for cliff jumps, bridges or overpasses. Enforce with `zSource`, do not leave it to judgement. |
| D11 | Drag cap of 40 m — right number? (§7.9.2) | Provisional. It is ~3.5 median official edges (11.26 m). Revisit once real contributors hit it; the severity thresholds matter more than the cap. |
| D12 | Who harvests the expanded POI dataset? (§7.11.1) | Open. It is the single largest unblocked dependency in Phase 5 and it is not a coding task. The CLEO HUD would be the tool for it, once it prints sub-metre coordinates (review-1 P2-3). |

---

## 12. Effort

| Phase | Days | Cumulative |
|---|---|---|
| 0 · Stop the bleeding | 1 | 1 |
| 1 · Nx + engine port | 3 | 4 |
| 2 · Binary + worker | 4 | 8 |
| 3 · React UI | 5 | 13 |
| 4 · Product features | 5 | 18 |
| 5 · Community + logistics | 14 | 32 |

**~18 focused days to the target in §1.** Phases 0–2 are the ones with hard numbers attached, and
they are the ones that make everything after them cheap.

Phase 5 nearly doubles that, and the split is worth seeing plainly: of its 14 days, **2 are pure data
harvesting** (§7.11.1) and **1 is paying off a defect** (§7.10.2, labels baked into the data). The
remaining 11 are feature work, and about half of it is guard rails — validating contributed geometry
so a stranger's recording cannot corrupt someone else's routing. That ratio is not overhead; it is
what makes accepting outside data possible at all.

Phase 6 is deliberately unestimated. See D8.
