# San Andreas Pathfinder 3D

A\* route planner over the official GTA:SA road network, with 3D terrain physics, on a Leaflet map.

**Current state:** vanilla JS prototype (4 `<script>` tags, no build). Being migrated to React +
TypeScript in an Nx monorepo. Read [SPEC.md](SPEC.md) before proposing architecture, and
[docs/CODE-REVIEW.md](docs/CODE-REVIEW.md) before claiming something is broken — it probably is, and
it's probably already documented with a finding id.

## Constraints

- **No libraries for the UI layer.** Components, panels, inputs, sheets, comboboxes are hand-written.
  Libraries are fine everywhere else (Leaflet, Vite, Vitest, React).
- **Leaflet stays.** The map engine is not being rewritten.
- **React + TypeScript**, `strict` + `noUncheckedIndexedAccess`. No `any` in `libs/`.
- **Python for data work.** The extraction/packing pipeline is a build-time backend, never a runtime
  service. Routing runs entirely in the browser — see SPEC.md §3 for why.
- **Nx monorepo** with enforced module boundaries.

## Layout

```
js/        vanilla engine + UI (being replaced; the engine is good, app.js is not)
data/      road-network datasets
tools/     verify-graph.mjs, bench-route.mjs — dev tooling, not shipped
docs/      CODE-REVIEW.md, SPEC.md lives at the root
.claude/   skills/ and commands/
```

## Before you change something

```bash
node tools/verify-graph.mjs     # dataset invariants + connectivity
node tools/bench-route.mjs      # A* timings against the recorded baseline
```

Any engine change needs a benchmark. Any dataset change needs the verifier.

Serving locally: `npx serve .` — the `npm start` script uses `python3 -m http.server`, which does not
run on Windows.

## Things that will mislead you

- **6.6% of road nodes cannot reach the rest of the map.** 31 connected components. "No route found"
  is usually this, not an A\* bug.
- **`lat` is GTA `y` and `lng` is GTA `x`.** Every mirrored-marker bug is this swap.
- **The A\* heuristic's admissibility margin is 7%** and its violation is completely silent.
- **Node ids change on every dataset rebuild.** Never persist one — persist world coordinates.
- **No node has a `name`.** Place search needs a POI dataset that does not exist yet.
- **Hardcoded counts in the README and `index.html` are wrong** (6,217 vs the actual 6,385). Verify
  numbers from the data.

## Conventions

Code, comments, commits, and docs in **English** (since commit `2d7cbd4`). User-facing strings are
translated ES/EN and live in `libs/i18n` — Spanish is the reference translation.

## Skills

`gta-graph-data` · `pathfinding-engine` · `sa-coordinates` · `ui-conventions`

## Commands

`/verify-graph` · `/bench-route` · `/port-module` · `/spec-status` · `/dev`
