---
description: Port one vanilla JS module to a typed Nx lib, following the migration rules in SPEC.md Phase 1.
argument-hint: "<js/file.js>  (e.g. js/elevation-cost.js)"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(node tools/:*), Bash(npx nx:*), Bash(npx vitest:*)
---

Port `$ARGUMENTS` from vanilla JS to its TypeScript home.

## Where it goes

| Source | Target lib | Nature |
|---|---|---|
| `js/elevation-cost.js` | `libs/terrain` | pure |
| `js/pathfinder.js` | `libs/pathfinding` | pure |
| `js/map-config.js` | `libs/geo` | pure |
| `js/app.js` | **do not port** | rewrite as features + bridge (Phase 3) |

`app.js` is deliberately excluded. It fuses A\* orchestration, Leaflet layer management, and HTML
string building into single functions. Porting it would preserve exactly the structure the migration
exists to remove.

## Rules

**1. Port behaviour, not bugs.** Read `docs/CODE-REVIEW.md` for this file first. Fix the findings it
lists as part of the port and say which ones you fixed. Do not fix anything it doesn't list — scope
creep during a migration makes the diff unreviewable.

**2. Purity is enforced.** Target libs may not import `leaflet`, touch `document`/`window`, fetch, or
format strings. They take world coordinates and return seconds and world units. Nx boundary tags
reject violations; do not add an exception.

**3. Types are load-bearing, not decoration.**
- No `any`. `strict` and `noUncheckedIndexedAccess` are on.
- Give the domain real types: `WorldPos`, `NodeIndex`, `Seconds`, `KmH`, `Route`, `Grade`. A branded
  `NodeIndex` prevents the class of bug where a node id and an array index get swapped.
- Model failure in the return type. `findShortestPath` returning `null` for both "unreachable" and
  "bad input" is what makes P0-3 possible. Return a discriminated union.

**4. Tests come with the port, not after.** These modules have never had a test. Cover:
- known-good outputs (use `tools/bench-route.mjs` numbers as fixtures)
- degenerate inputs — same node, adjacent nodes, zero-length segments, missing `z`
- the **heuristic admissibility property**: for a sample of edges,
  `heuristic(a, b) ≤ actualCost(a, b)`. This is the invariant whose violation is invisible.

Target ≥ 90% coverage on these libs. That is where all the project's coverage lives.

**5. Verify equivalence before deleting anything.** Run `node tools/bench-route.mjs --json` before
and after. Identical hops, km, and minutes on all six pairs, or explain precisely why they differ.
Leave the original `js/` file in place until Phase 3 removes the old `index.html` — both must keep
working during the migration.

## Report

State: what moved where, which review findings were fixed, which types were introduced, the test
count and coverage, and the before/after benchmark comparison.

Background: the `pathfinding-engine`, `sa-coordinates`, and `ui-conventions` skills.
