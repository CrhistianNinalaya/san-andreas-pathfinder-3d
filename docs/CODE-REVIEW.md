# Code Review — San Andreas Pathfinder 3D

**Date:** 2026-08-25 · **Commit reviewed:** `d26fa63` · **Scope:** entire tree (4 JS files, 1 CSS, 1 HTML, 3 datasets)

Every number below is measured, not estimated. Reproduce with:

```bash
node tools/verify-graph.mjs && node tools/bench-route.mjs
```

---

## Verdict

The engine is better than the app around it.

`pathfinder.js` and `elevation-cost.js` are genuinely good: a correct A\*, a real MinHeap, a spatial hash for nearest-neighbour, an admissible heuristic, and a physics model that is at least internally consistent. Cross-state routing measures **0.4–31 ms**, which is *faster* than the ~100 ms the README claims.

Everything above that line is a prototype: four `<script>` tags sharing `window`, eight mutable globals, DOM built by string concatenation, and no types, tests, or build step. That's fine for what this was — but it's the reason a change to the panel can break routing.

The two problems that hurt users today are not style problems:

- **6.6% of the road network cannot be routed to**, and the app says only "No road connection found."
- **Switching the network scope silently breaks every existing waypoint.**

Both are fixable in a day. See [SPEC.md](../SPEC.md) Phase 0.

---

## Measured baseline

| | Full network | San Fierro subset |
|---|---|---|
| Nodes / directed edges | 28,991 / 59,620 | 6,385 / 13,128 |
| On disk (JSON) | 5.52 MB | 1.09 MB |
| Parse (main thread) | 63 ms | — |
| Graph build (main thread) | 147 ms | — |
| Connected components | 31 | 19 |
| Nodes outside giant component | **1,908 (6.6%)** | **1,261 (19.7%)** |
| One-way edges | 0 | 0 |
| Packed binary would be | 602 KB (**9.4×** smaller) | 133 KB (8.4× smaller) |

Route timings (median of 5, full network):

| Route | Median | Hops |
|---|---|---|
| Los Santos: Grove St → LS Airport | 8.0 ms | 136 |
| San Fierro → Los Santos | 31.3 ms | 347 |
| Las Venturas → San Fierro | 14.1 ms | 254 |
| Mt Chiliad → Angel Pine | 0.6 ms | 275 |
| LS downtown short hop | 0.4 ms | 58 |

---

## Findings

Severity: **P0** breaks user-visible behaviour · **P1** costs real performance or correctness margin · **P2** architecture · **P3** hygiene.

### P0-1 — Switching the network scope strands every waypoint

[`js/app.js:511`](../js/app.js#L511)

Node ids are `<areaId>_<index>`. The San Fierro subset only contains area-16 ids (`16_0`, `16_1`, …), the full network contains all areas. When the `select-scope` handler swaps datasets it rebuilds `graph` but never touches `waypoints[i].snapNode`, which still holds ids from the previous graph. `findShortestPath` then hits `!this.nodes.has(startId)` and returns `null`, and the panel renders "No road connection found between these points" — for two markers sitting on a visible road.

**Fix:** after any graph load, re-snap every waypoint from its stored `gtaCoords`, which is dataset-independent.

### P0-2 — 1,908 nodes are unroutable and nothing says so

[`js/pathfinder.js:124`](../js/pathfinder.js#L124)

`findNearestNode` returns the geometrically nearest node with no regard for which connected component it belongs to. The full network has 31 components; 1,908 nodes (6.6%) live in the 30 small ones — islands, isolated lots, severed ramps. Snap into one and no route exists to anywhere else, ever.

The San Fierro subset is far worse at **19.7%**, because it was cut by area id and every edge crossing an area boundary was severed. That subset is effectively broken as a routing dataset.

**Fix:** label components at graph-build time (union-find, ~10 ms). Snap only to nodes in the giant component, and surface "nearest reachable road is 340 m away" instead of a dead end.

### P0-3 — Multi-stop legs fail silently and the total lies

[`js/app.js:249`](../js/app.js#L249)

```js
const result = graph.findShortestPath(fromNode.id, toNode.id);
if (result) {           // ← a null leg is skipped, and that is the whole error handling
  routeLegs.push(...);
  totalDist += result.totalDistance;
}
```

If leg B→C fails, its distance and time are simply omitted, but the summary still renders as **"🏁 Total Route (A ➔ D)"** with a badge saying "4 Stops". The polyline draws a straight line across the gap. The user gets a plausible, confidently-presented, wrong trip.

**Fix:** a failed leg must be a first-class result. Mark the leg unreachable in the panel and never fold it into a total.

### P1-1 — The cache-buster cancels the CDN configuration

[`js/app.js:70`](../js/app.js#L70) vs [`vercel.json:5`](../vercel.json#L5)

```js
const response = await fetch(`${datasetUrl}?v=${Date.now()}`);
```

`vercel.json` carefully sets `public, max-age=31536000, immutable` on `/data/(.*)`. A unique timestamp per request makes that header unreachable: every visit re-downloads 5.52 MB. The two files are working against each other.

**Fix:** delete the timestamp. Version the dataset in its filename when it actually changes.

### P1-2 — 210 ms of main-thread block at startup

Measured: 63 ms `JSON.parse` + 147 ms graph construction, on top of the 5.52 MB download. The map is unresponsive throughout and the badge reads "Loading network..." with no progress.

The dataset also carries weight it never uses:

- `edge.dist` is present on all 59,620 edges and **never read** — [`pathfinder.js:90`](../js/pathfinder.js#L90) recomputes 3D distance from coordinates.
- **No node has a `name` field**, yet [`pathfinder.js:76`](../js/pathfinder.js#L76) allocates the string `` `Node ${node.id}` `` for all 28,991 of them. The field is never displayed anywhere.
- **All 59,620 edges are reciprocal** — half are redundant.

A packed binary of the same graph is **602 KB**. See [SPEC.md](../SPEC.md) Phase 2.

### P1-3 — Load race and doubled memory

[`js/app.js:513`](../js/app.js#L513) · [`js/app.js:71`](../js/app.js#L71)

`loadGraphData` has no in-flight guard. Two quick scope switches can resolve out of order and leave `graph` built from one dataset while `rawData` holds the other — the debug layer then draws nodes that aren't in the graph.

Separately, `rawData` is retained for the entire session purely so the debug layer can filter it, while `graph` holds a fully-materialised copy of the same content. The parsed JSON is roughly 30–60 MB of JS objects, held twice.

### P1-4 — The heuristic's admissibility margin is 7% and undefended

[`js/pathfinder.js:164`](../js/pathfinder.js#L164)

```js
const maxSpeedMps = (130 * 1000) / 3600;
```

The dataset's speeds are `{70, 110}`. Downhill applies a 1.10× bonus, so the true ceiling is **121 km/h**. 130 is admissible — by 7%.

This is the one number that, if wrong, makes A\* return non-optimal routes *with no error, no warning, and no visible symptom*. A future dataset with a `speed` above 118 breaks it silently.

**Fix:** derive the ceiling from the data at build time (`max(speed) × maxDownhillMultiplier`) and assert it. `tools/verify-graph.mjs` already reports the required value.

### P1-5 — Debug layer truncates silently and goes stale

[`js/app.js:537`](../js/app.js#L537)

`.slice(0, 1500)` caps the render with no indication that nodes are missing, and there is no `moveend` listener — pan the map and the dots stay where they were. Each is an SVG `circleMarker`, which is the expensive way to draw 1,500 dots.

### P1-6 — MinHeap re-expands stale entries

[`js/pathfinder.js:202`](../js/pathfinder.js#L202)

Standard lazy-deletion A\* pushes duplicates, but the pop loop has no `if (poppedCost > costSoFar.get(id)) continue;` guard, so outdated entries re-expand their neighbours. Results are correct; the work is wasted. Cheap win on the 31 ms cross-state route.

### P2-1 — No module boundaries

[`index.html:82`](../index.html#L82)

```html
<script src="js/map-config.js?v=4.0"></script>
<script src="js/elevation-cost.js?v=4.0"></script>
<script src="js/pathfinder.js?v=4.0"></script>
<script src="js/app.js?v=4.0"></script>
```

Load-order-dependent globals, cache-busting maintained by hand, and defensive `typeof ElevationPhysics !== 'undefined'` checks in `pathfinder.js` guarding against a script tag being reordered. `app.js` owns eight mutable module-level globals (`map`, `graph`, `rawData`, `waypoints`, `routeLegs`, `routePolylines`, `debugLayerGroup`, `showDebugGraph`, `currentAlternativeRoutes`, `activeAltRouteIndex`).

No build, no types, no tests, no linter.

### P2-2 — Domain logic fused to the DOM

`calculateAndRenderMultiRoute` ([`app.js:222`](../js/app.js#L222)) picks the routing strategy, runs A\*, accumulates totals, *and* calls two renderers. `renderMultiRouteInPanel` ([`app.js:392`](../js/app.js#L392)) re-derives elevation totals that the routing step already computed, formats them, and builds HTML.

Nothing in `app.js` can be tested without a browser and a live Leaflet map. The engine underneath it is pure and testable — and has no tests.

### P2-3 — DOM built by string concatenation

Twelve `innerHTML =` sites. It is safe *today* only because the dataset contains no strings — the moment place names or user-named waypoints arrive (both are in the Phase 3 plan), every one of these is an injection site. It also destroys and rebuilds event handlers on each render, which is why `renderWaypointsList` has to re-attach a click listener per card.

### P2-4 — Presentation in markup and in JS

Inline `style` attributes at [`index.html:33`](../index.html#L33), `:43`, `:72` and inside JS at [`app.js:443`](../js/app.js#L443), `:457`, `:461` — sitting next to a stylesheet that already defines classes for the same visual language. `.node-dot` in [`style.css:320`](../css/style.css#L320) is defined and never used.

### P2-5 — The physics model is undocumented, so its output reads as measurement

[`js/elevation-cost.js:49`](../js/elevation-cost.js#L49)

Two modelling choices are invisible to the reader:

1. **GTA world units are treated as metres.** They are not metres. Every "7.7 km / 5.3 min" in the UI is a model output presented as a measurement.
2. **The slope multiplier is a step function** — 1.00 at +4% grade, 0.75 at +4.01%. A 25% cost cliff at an arbitrary threshold makes route choice jumpy near it, and makes the cost function non-differentiable for any future optimisation.

Neither is wrong. Both should be stated in the UI and in the code.

### P2-6 — "Alternative routes" are weakly differentiated

[`js/pathfinder.js:268`](../js/pathfinder.js#L268)

Penalise-and-rerun (×3.5 per used edge) is a reasonable cheap approach, but there is no similarity threshold, so an "alternative" is often the same highway with one block of detour. The loop can also return fewer routes than requested with no signal to the caller.

### P3 — Hygiene

| | |
|---|---|
| [`index.html:37`](../index.html#L37) & README | Claim the SF subset has **6,217** nodes. It has **6,385**. Hardcoded in two places, wrong in both. |
| `data/san_fierro_nodes.json` | Orphaned. 12 KB, referenced nowhere, undocumented in the README's file tree — and the only file that ever carried human-readable place names (`"Gant Bridge Norte"`). Worth harvesting before deleting. |
| [`package.json:7`](../package.json#L7) | `"start": "python3 -m http.server 8080"` does not run on this Windows machine. |
| [`index.html:9`](../index.html#L9), `:79` | Leaflet from unpkg with no SRI hash and no fallback. Third-party CDN outage takes the app down. |
| [`app.js:507`](../js/app.js#L507) | `map.setView([0, 0], -1)` hardcodes what `GTA_MAP_CONFIG.defaultView` already holds. |
| `css/style.css`, `.gitignore` | Spanish comments left behind by the translate-to-English commit (`2d7cbd4`). |
| README | Claims ~100 ms cross-state routing. Measured 31 ms. Understating your own engine. |

---

## What to keep

Worth saying explicitly, because the migration should port these rather than rewrite them:

- **`MinHeap`** — correct, tight, no allocation churn in the hot loop.
- **The spatial hash** ([`pathfinder.js:124`](../js/pathfinder.js#L124)) — expanding-ring search with a correct early-exit bound (`minDist <= (r + 1) * cellSize`). That bound is subtle and it's right.
- **`ElevationPhysics`** — entirely pure, entirely static, zero dependencies. It is already a library; it just needs types and tests.
- **The penalise-and-rerun alternatives strategy** — the right complexity for the problem.
- **`GTA_MAP_CONFIG`** — one place owning the coordinate mapping is exactly right, even if it's currently three functions.
- **The dataset itself** — zero duplicate ids, zero dangling endpoints, zero self-loops, zero out-of-bounds nodes, finite `z` everywhere. Whatever extracted this from `NODES.DAT` did a clean job.

---

## Next

See [SPEC.md](../SPEC.md). Phase 0 is the P0 list above against the current vanilla code — worth doing before the migration, so the migration has a correct baseline to port.
