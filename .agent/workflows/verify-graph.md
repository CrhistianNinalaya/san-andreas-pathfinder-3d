---
description: Validate the road-network datasets — invariants, connectivity, and packed-size estimate — and explain what any failure means.
argument-hint: "[path/to/dataset.json]"
allowed-tools: Bash(node tools/verify-graph.mjs:*), Read, Grep, Glob
---

Validate the San Andreas road graph datasets.

Run the checker (on `$ARGUMENTS` if a path was given, otherwise every dataset):

```bash
node tools/verify-graph.mjs $ARGUMENTS
```

Then **interpret the output** — do not just paste it back. For each failing invariant, say what
breaks for a user, not just what the rule is:

| Invariant | What a failure means in the app |
|---|---|
| duplicate node ids | Later nodes silently overwrite earlier ones; edges attach to the wrong place. |
| dangling endpoints | `RoadGraph.init` skips those edges — roads vanish with no warning. |
| duplicate edges | Wasted memory and a distorted alternative-route penalty (an edge gets penalised twice). |
| self-loops | Zero-cost cycles in A\*; harmless today, a hang risk if costs ever go negative. |
| out-of-bounds coords | Markers land outside the map image; the spatial hash allocates empty cells. |
| non-finite `z` | `NaN` propagates through the cost function and A\* silently returns no route. |
| **giant component < 90%** | The big one. Every node outside it is a dead end — a user clicks a visible road and gets "No road connection found". |

Known state as of commit `d26fa63` — do not report these as new discoveries:

- `san_andreas_official_nodes.json` passes, with 1,908 nodes (6.6%) orphaned across 30 small
  components.
- `san_fierro_official_nodes.json` **fails** the component check at 19.7% orphaned. This is expected
  and intended: the subset was cut by area id, which severed cross-boundary edges. SPEC.md §6.3
  deletes this file rather than fixing it. Do not "fix" it by lowering the threshold.
- Both warn on full reciprocity (no one-way roads survived extraction) and on having no node names.

If everything passes, report the packed-binary estimate and the current `.sapg` target from
SPEC.md §6.2 (818 KB raw, ~450 KB over the wire) so size regressions are visible.

Background: the `gta-graph-data` skill.
