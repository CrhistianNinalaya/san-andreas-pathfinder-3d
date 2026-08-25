---
description: Audit the repo against SPEC.md — what is actually done, what is claimed but not true, and the next concrete task.
allowed-tools: Read, Grep, Glob, Bash(node tools/:*), Bash(git log:*), Bash(git status:*)
---

Audit the current state of the repository against [SPEC.md](../../SPEC.md).

**Verify from the code, not from the documents.** SPEC.md and README.md state intentions and both
have been wrong before — the README claimed 6,217 nodes in the San Fierro subset when it has 6,385,
and claimed ~100 ms routing when it measures 31 ms.

## Check

**Phase 0 — Stop the bleeding.** Read `js/app.js` and `js/pathfinder.js` and check each P0/P1 in
`docs/CODE-REVIEW.md`:
- waypoints re-snapped after a graph load (P0-1)
- component-aware snapping (P0-2)
- failed multi-stop legs excluded from totals (P0-3)
- no `?v=${Date.now()}` on the dataset fetch (P1-1)
- in-flight guard on `loadGraphData`, `rawData` released (P1-3)
- heuristic ceiling derived from the data, not the literal `130` (P1-4)
- stale-pop guard in the A\* loop (P1-6)

**Phase 1 — Nx + engine port.** Does `nx.json` exist? Do `libs/pathfinding`, `libs/terrain`,
`libs/geo` exist with tests? Run the tests — do not trust their presence.

**Phase 2 — Binary + worker.** Does `docs/graph-format.md` exist? A `.sapg` file? Does
`tools/pipeline/` produce it? Is there a worker under `apps/web/src/worker`? Is the San Fierro
subset deleted (§6.3)? Measure the payload against the 500 KB wire budget.

**Phase 3 — React UI.** Does `apps/web` render? Any `innerHTML` left (P2-3)? Any inline `style`
attributes (P2-4)? Does `libs/map-bridge` hold the only `import 'leaflet'`? Does a shared URL
round-trip?

**Phase 4 — Product features.** POI dataset with names? Search combobox? Vehicle profiles? Mobile
sheet? Turn-by-turn?

Also run:

```bash
node tools/verify-graph.mjs
node tools/bench-route.mjs
```

## Report

1. **Phase table** — done / partial / not started, with the file or measurement that proves it.
2. **Drift** — anything SPEC.md, README.md, or a skill claims that the code contradicts. Include
   hardcoded counts, since those have been wrong twice.
3. **Open decisions from §11** that are still unresolved and are now blocking work.
4. **The single next task.** One task, the smallest useful unit, with the file to open.

Be blunt about partial work. "Phase 2 partial" with three of six items done is more useful than a
percentage.
