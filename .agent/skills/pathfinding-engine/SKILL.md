---
name: pathfinding-engine
description: Rules for changing the A* routing engine and the terrain physics model — admissibility of the heuristic, MinHeap and CSR invariants, nearest-node snapping, alternative routes, purity constraints, and how to benchmark a change. Use when editing pathfinder/A*/MinHeap/spatial-hash/elevation code, or when routes come out wrong, slow, or missing.
---

# The routing engine

Lives in `js/pathfinder.js` + `js/elevation-cost.js` today, `libs/pathfinding` + `libs/terrain`
after the migration. This is the good part of the codebase. Treat it accordingly.

## The one rule

**The engine is pure. No DOM, no Leaflet, no `window`, no fetch.**

Everything is a function of `(graph, ids, options) → result`. That is what makes it unit-testable,
worker-safe, and portable. `libs/pathfinding` importing `leaflet` or touching `document` is a
boundary violation, and Nx lint will reject it. The current `app.js` gets this wrong; the engine does
not — keep it that way.

Corollary: the engine never formats. It returns seconds and world units. `"5.3 min"` and `"7.7 km"`
are the UI's job.

## Admissibility — the invariant that fails silently

```js
const maxSpeedMps = (130 * 1000) / 3600;   // pathfinder.js:164
```

A\* returns the optimal path **only if the heuristic never overestimates**. The heuristic here is
`distance3D / maxSpeed`, so `maxSpeed` must be at least the fastest speed any edge can actually be
traversed at.

Current margin: the dataset tops out at **110 km/h nominal**, the downhill multiplier is **1.10×**,
so the true ceiling is **121 km/h**. The literal `130` is admissible by 7%.

**If a future dataset has an edge above 118 km/h, A\* silently returns non-optimal routes.** No
error, no warning, no crash, no visible symptom — just quietly worse routes. This is the highest-risk
line in the repo.

Rules:

1. Derive the ceiling: `max(edge.speed) × maxDownhillMultiplier`. Never a literal.
2. Assert it on graph load. `.sapg` carries `maxSpeedKmh` in its header for this purpose.
3. Keep the property test: for a random sample of edges,
   `heuristic(a, b) ≤ actualTraversalCost(a, b)`.
4. If you make the heuristic *faster* by inflating it, you have chosen speed over optimality —
   say so explicitly, in a comment and in the return value.

## Component-aware snapping

`findNearestNode` returns the geometrically nearest node with no regard for reachability. **1,908
nodes (6.6%) live in 30 small components** and can never reach the rest of the map.

Snapping into one produces "no route found" for two markers sitting on visible roads. This is not an
A\* failure — A\* is correctly reporting that no path exists.

Snap into the giant component. If the nearest reachable road is far, say so
(`"nearest reachable road is 340 m away"`), don't return a dead end. Component ids are precomputed —
see the `gta-graph-data` skill.

## Structures and their invariants

**`MinHeap`** — lazy-deletion binary heap, no decrease-key. Duplicate entries for the same node are
expected and correct; the `costSoFar` check during relaxation makes results right. But the pop loop
should skip stale entries:

```js
const popped = frontier.pop();
if (poppedCost > costSoFar.get(popped)) continue;   // currently missing — wasted expansions
```

**Spatial hash** — 200-unit cells, expanding-ring search, with this early exit:

```js
if (nearest && minDist <= (r + 1) * this.cellSize) break;
```

That bound is subtle and it is correct: a node at distance `minDist` cannot be beaten by anything in
a ring that starts farther than `minDist`. Do not "simplify" it. Do not raise `cellSize` without
re-measuring — it trades memory against ring count.

**CSR adjacency** (post-Phase 2) — `adjOffset[i]` to `adjOffset[i+1]` indexes `adjTarget`. Node ids
are array indices. **No strings in the hot loop, ever.** The current `Map<string, Edge[]>` design is
where the 147 ms build time goes.

## Alternative routes

Penalise-and-rerun: run A\*, multiply every used edge's cost by 3.5, run again. Cheap and it works.

Two things it gets wrong today:
- No similarity threshold — an "alternative" is often the same highway with a one-block detour.
  Reject routes with > 70% edge overlap against an already-accepted one.
- It can return fewer routes than requested with no signal. Return `{ routes, requested, found }`.

Reported distance and time must use **unpenalised** edge costs. The penalty exists to steer the
search, not to describe the road. The current code gets this right.

## Terrain physics

`ElevationPhysics` is pure static methods, zero dependencies. Two modelling choices to keep in mind:

1. **World units are treated as metres.** They aren't. Every "km" and "min" is a model output.
2. **The slope multiplier is a step function** — 1.00 at +4.0% grade, 0.75 at +4.01%. A 25% cost
   cliff at an arbitrary threshold makes route choice jumpy near it. Replace with a continuous curve
   when vehicle profiles land (SPEC.md §7.3), keeping the same overall shape.

## Benchmarking — required for any engine change

```bash
node tools/bench-route.mjs              # 6 fixed OD pairs, median of 5
node tools/bench-route.mjs --runs=20
node tools/bench-route.mjs --json       # for regression tracking
```

Current baseline on the full network:

| | |
|---|---|
| JSON parse | 63 ms |
| Graph build | 147 ms |
| Cross-state route (SF → LS, 347 hops) | 31 ms |
| Intra-city route | 0.4–8 ms |

CI fails a PR that regresses any median by more than 20%.

The benchmark evaluates the shipped engine files in a VM rather than a copy, so it cannot drift. If
the engine moves, update `ENGINE_FILES` at the top of the script.

The OD pairs are **world coordinates, not node ids** — ids change on every dataset rebuild.

## Before claiming a routing bug

Check in this order:

1. Did both endpoints snap into the giant component? (30 small components, 6.6% of nodes.)
2. Are the node ids from the *current* graph? Switching datasets invalidates them.
3. Is the heuristic still admissible against this dataset's max speed?
4. Is the route genuinely non-optimal, or just not the one you expected? The cost function is time
   under a slope model, not distance — a longer flat road legitimately beats a shorter climb.
