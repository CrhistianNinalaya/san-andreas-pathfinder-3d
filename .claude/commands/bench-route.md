---
description: Benchmark the A* engine against the recorded baseline and report regressions.
argument-hint: "[--runs=N] [--data=path]"
allowed-tools: Bash(node tools/bench-route.mjs:*), Read, Grep, Glob
---

Benchmark the routing engine.

```bash
node tools/bench-route.mjs --runs=10 $ARGUMENTS
```

The script evaluates the shipped engine files in a VM context rather than a copy, so it always
measures the real code. If the engine has moved (Phase 1 relocates it to `libs/pathfinding`), update
`ENGINE_FILES` at the top of `tools/bench-route.mjs` before reporting anything.

**Baseline** — commit `d26fa63`, full network, median of 5:

| Stage | Baseline |
|---|---|
| JSON parse | 63 ms |
| Graph build | 147 ms |
| Los Santos: Grove St → LS Airport (136 hops) | 8.0 ms |
| San Fierro → Los Santos (347 hops) | 31.3 ms |
| Las Venturas → San Fierro (254 hops) | 14.1 ms |
| Mt Chiliad → Angel Pine (275 hops) | 0.6 ms |
| Bone County → Las Venturas (161 hops) | 2.6 ms |
| LS downtown short hop (58 hops) | 0.4 ms |

Report:

1. **Any median more than 20% above baseline** — that is a CI failure, name the pair and the delta.
2. **Any pair that returns NO ROUTE.** This is almost never an A\* bug — it means an endpoint snapped
   into one of the 30 orphaned components. Run `/verify-graph` before investigating the algorithm.
3. **Whether the route results changed.** Hops, km and minutes are printed for a reason: a change
   that makes routing faster but alters the returned paths is a correctness change wearing a
   performance costume. Say so explicitly.
4. Progress against the Phase 2 targets in SPEC.md §8: main-thread block under 16 ms, cross-state
   route under 20 ms.

Note that the OD pairs are world coordinates, not node ids — ids change on every dataset rebuild, so
they are re-snapped each run. If a pair starts routing somewhere visibly different, the dataset
changed, not the engine.

If the change under test touched the heuristic, the cost function, or `MinHeap`, benchmarking is not
sufficient — check the admissibility invariant too. See the `pathfinding-engine` skill.
