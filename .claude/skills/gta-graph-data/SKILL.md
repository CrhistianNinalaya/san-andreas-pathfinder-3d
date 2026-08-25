---
name: gta-graph-data
description: Working with the San Andreas road-network datasets — the JSON and .sapg formats, their invariants, connected components, node ids, speeds, and the Python pipeline that produces them. Use whenever reading, generating, packing, validating, filtering or debugging anything under data/ or tools/pipeline/, or when a route unexpectedly does not exist.
---

# The San Andreas road graph

## What the data actually is

Extracted from Rockstar's `NODES.DAT` (vehicle path nodes). Measured facts, not assumptions — all
of these are verifiable with `node tools/verify-graph.mjs`:

| | Full network | San Fierro subset |
|---|---|---|
| Nodes / directed edges | 28,991 / 59,620 | 6,385 / 13,128 |
| JSON on disk | 5.52 MB | 1.09 MB |
| Connected components | 31 | 19 |
| Nodes outside the giant component | 1,908 (**6.6%**) | 1,261 (**19.7%**) |
| One-way edges | **0** | **0** |
| Distinct speeds | 70, 110 km/h | 70, 110 km/h |

## Five things that are counter-intuitive

**1. The graph is fully reciprocal — there are no one-way roads.**
Every one of the 59,620 directed edges has its mirror. The one-way flags in `NODES.DAT` did not
survive extraction. Consequences: reversing a route always yields the exact mirror; the adjacency
can be stored undirected and halved; and any code that *reasons* about one-way streets is reasoning
about something that isn't in the data.

**2. 6.6% of nodes cannot reach the rest of the map — ever.**
31 components. Islands, isolated lots, severed ramps. If `findNearestNode` snaps a click into one of
the 30 small ones, no route exists to anywhere outside it. This is the single most common cause of
"no route found" and it is not a bug in A\*. **Always snap into the giant component.** Component ids
are precomputed in the `.sapg` header specifically so this check is O(1).

**3. Node ids encode the area: `<areaId>_<index>`, e.g. `16_0`.**
Ids are extraction-order dependent — they change whenever the dataset is rebuilt. **Never persist a
node id** (not in a URL, not in a test fixture, not in a bookmark). Persist world coordinates and
re-snap. `tools/bench-route.mjs` does exactly this and that is why it keeps working.

**4. The San Fierro subset is a trap.** It was cut by area id, which severed every edge crossing an
area boundary — hence 19.7% orphaned nodes. `verify-graph.mjs` fails on it, correctly. SPEC.md §6.3
deletes it in favour of an `areaId` filter over the full graph. Do not build new features on it.

**5. Two fields carry no information.** `edge.dist` is never read — `RoadGraph` recomputes 3D
distance from coordinates. And **no node has a `name`**, despite the code allocating a `Node ${id}`
fallback string for all 28,991. Place names need a separate POI dataset (SPEC.md §6.5).

## Formats

### JSON (current)

```json
{
  "name": "GTA San Andreas - Full Official Network",
  "nodes": [{ "id": "0_0", "x": -2427.6, "y": -2474.8, "z": 35.8 }],
  "edges": [{ "from": "0_0", "to": "0_106", "dist": 45, "speed": 110 }]
}
```

`x`, `y`, `z` are GTA world units in `[-3000, 3000]`. They are **not metres** — the UI presents them
as metres as a deliberate modelling choice (SPEC.md D5).

### `.sapg` binary (target — SPEC.md §6.2)

Structure of Arrays + CSR adjacency, little-endian. 818 KB vs 5.52 MB. The reader builds typed-array
views over one `ArrayBuffer` with zero parsing and zero per-node allocation.

Header carries `nodeCount`, `edgeCount`, `componentCount`, and **`maxSpeedKmh`** — the last exists so
the A\* heuristic derives its admissibility bound from the data instead of a magic literal. Body is
`f32 x[] · f32 y[] · f32 z[] · u16 componentId[] · u8 areaId[] · u32 adjOffset[N+1] · u32 adjTarget[E] · u8 adjSpeedKmh[E]`.

Normative spec: `docs/graph-format.md`. The format is a contract between the Python writer and the
TypeScript reader — **any change needs a round-trip test and a version bump.**

## Invariants

Enforced by `tools/verify-graph.mjs`, run in CI. Any generated dataset must satisfy all of them:

- unique node ids
- no dangling edge endpoints
- no duplicate edges, no self-loops
- every coordinate within `[-3000, 3000]`
- finite `z` on every node
- **giant component ≥ 90% of nodes**

```bash
node tools/verify-graph.mjs           # all datasets, human-readable
node tools/verify-graph.mjs --json    # machine-readable
```

Exit code 1 means an invariant broke. Warnings (reciprocity, missing names) never fail the run.

## Pipeline

Python, build-time only, never a runtime service (SPEC.md §3.2). Lives in `tools/pipeline/`:
`extract_nodes.py` (NODES.DAT → `.sapg`), `build_tiles.py` (144 `.txd` → tile pyramid),
`build_pois.py` (POI dataset), `verify.py`.

Python is the right choice here — `struct`, `numpy`, `Pillow` do binary packing and image tiling in
a fraction of the code JS needs, and none of it ships to the browser.

## When touching this data

- Regenerating a dataset invalidates every node id. Check for persisted ids first.
- Adding a field? Ask whether anything reads it. `edge.dist` is the cautionary tale.
- Changing `.sapg`? Bump `version`, update `docs/graph-format.md`, add a round-trip test.
- Raising a speed above 118 km/h **silently breaks A\* optimality** — see the `pathfinding-engine`
  skill. Update `maxSpeedKmh` in the header and the assertion will catch it.
