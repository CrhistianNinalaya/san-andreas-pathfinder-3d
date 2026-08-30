---
name: shortcut-curation
description: Principles, mathematical invariants, and automated algorithms for curating player-recorded CLEO trajectories (shortcuts, off-road circuits, stunt jumps) into the GTA San Andreas road network. Eliminates lane offsets, retrocesos (backtracking U-turns), redundant asphalt parallel runs, and ensures smooth vector-aligned merges into the giant component.
---

# Shortcut & Custom Network Curation

This skill codifies the rules, geometry, and algorithms required to transform raw GPS logs recorded in-game via CLEO (`cleo/shortcuts.ini`) into high-performance, seamless road network additions in `public/data/custom/shortcuts/` and `manifest.json`.

---

## 1. The 3 Systemic Distortions in Raw GPS Recordings

When a player records trajectories in GTA San Andreas (e.g. via `samp_shortcut_recorder.cs`), three predictable geometric distortions occur:

### Distortion 1: The Lane Offset ($\sim 5$ to $7\,\text{m}$)
* **The Cause:** Official road nodes in `NODES.DAT` are placed strictly on the **centerline** (median / double yellow line) of 2-way streets.
* **The Effect:** Players naturally drive inside their lane. Coordinates logged on the vehicle are displaced $\pm 5\,\text{m}$ to $7\,\text{m}$ perpendicular to the road axis (e.g. driving west on an east-west street places coordinates $\sim 6\,\text{m}$ north / "más arriba" of the centerline nodes).
* **The Rule:** Any trajectory segment running parallel to an existing official road before/after the detour must be snapped or aligned directly to the road centerline ($P_{start} \to N_{official}$).

### Distortion 2: Redundant Asphalt Lead-in / Lead-out
* **The Cause:** Players press `I` (REC) several seconds before entering an alley or ramp, and press `O` (STOP) after rejoining the destination street.
* **The Effect:** The recorded trajectory includes $3$ to $8$ points that merely duplicate roads that already exist in `NODES.DAT`.
* **The Rule:** Prune redundant parallel lead-in points. A shortcut must begin at the **fork node** ($N_{fork}$) where the vehicle actually diverges from the official corridor, and terminate at the **merge node** ($N_{merge}$) where it re-enters.

### Distortion 3: The "Retroceso" (Backtracking Hairpin / $180^\circ$ U-turn)
* **The Cause:** Naive nearest-neighbor snapping uses Euclidean distance: $\arg\min_{N} \|N - P_{end}\|$.
* **The Effect:** When the vehicle stops just past an official node $N_{behind}$, $N_{behind}$ is numerically closer than the forward node $N_{forward}$. Snapping backwards creates an acute hairpin loop ($< 60^\circ$): the path enters the street, reverses direction, and turns around, severely penalizing the A* heuristic and causing erratic routing.
* **The Rule: The Forward Vector Invariant ($\vec{v} \cdot \vec{d} > 0$)**.

---

## 2. The Forward Vector Invariant

Given:
* The trajectory's exit direction vector:
  $$\vec{v} = P_n - P_{n-1}$$
* The vector from the final point to candidate official node $N_i$:
  $$\vec{d}_i = N_i - P_n$$

A candidate node $N_i$ is a **valid forward merge** if and only if:
$$\vec{v} \cdot \vec{d}_i > 0 \iff \cos(\theta) > 0 \quad (\theta < 90^\circ)$$

If $\vec{v} \cdot \vec{d}_i \le 0$, the candidate lies **behind** the vehicle's momentum. Connecting to it causes a retroceso. The algorithm must select the candidate satisfying $\vec{v} \cdot \vec{d}_i > 0$ that minimizes lateral deviation from the vehicle's heading.

Similarly for the entrance:
$$\vec{v}_{entry} = P_2 - P_1$$
The incoming official road segment must feed into $P_1$ without requiring an acute reverse turn unless the physical geometry dictates a sharp turn.

---

## 3. Automated Curation Algorithm

Given raw recording points $P_1, P_2, \dots, P_m$:

1. **Detect Fork Node ($N_{fork}$):**
   * Identify official road nodes within $40\,\text{m}$ of the early points.
   * Locate the point $P_k$ where lateral distance to the official street axis exceeds the road corridor threshold ($> 8.0\,\text{m}$).
   * Set $P_1' = N_{fork}$ (the official node nearest to where divergence begins).
   * Discard redundant points $P_1, \dots, P_{k-1}$.

2. **Resample Trajectory ($\sim 10.5\,\text{m}$ Spacing):**
   * Filter intermediate points using a distance step of $10.0\,\text{m} \le \Delta s \le 12.0\,\text{m}$ to match Rockstar's median node spacing ($11.3\,\text{m}$).

3. **Detect Merge Node ($N_{merge}$):**
   * Identify candidate official nodes near the final trajectory points.
   * Filter candidates by the forward vector condition:
     $$(P_n - P_{n-1}) \cdot (N_{cand} - P_n) > 0$$
   * Select the candidate $N_{merge}$ that aligns with the vehicle's exit trajectory.
   * If trailing points $P_{n}, P_{n+1}$ have overshot past $N_{merge}$ onto the asphalt, prune them and snap the terminal point directly to $N_{merge}$.

4. **Connect Graph Edges & Unidirectional Invariant:**
   * **Unidirectional Jump & Cliff Drops (`oneWay: true`):**
     If the trajectory contains a stunt ramp jump, cliff descent, or sheer vertical drop (e.g. Mount Chiliad cliff descent), mark the shortcut as `"oneWay": true`.
     * Generate **forward directed edges only**:
       $N_{fork} \to P_1'$, $P_i' \to P_{i+1}'$, and $P_{last}' \to N_{merge}$.
     * **Strictly omit reverse edges**. This prevents the A* routing engine / GPS from ever proposing an impossible reverse ascent up a vertical cliff or reverse jump.
   * **Bidirectional Trails (`oneWay: false`):**
     For drivable two-way dirt roads and trails, generate reciprocal edges:
     $N_{fork} \leftrightarrow P_1'$, $P_i' \leftrightarrow P_{i+1}'$, and $P_{last}' \leftrightarrow N_{merge}$.
   * Set descriptive labels, unique color tokens, and verify graph invariants.

---

## 4. Checklist for Curating Any Shortcut

- [ ] Does $P_1$ start directly on, or snap forward into, the official junction node?
- [ ] Are redundant points cruising along existing streets trimmed?
- [ ] Is every intermediate segment spaced at approximately $10.5\,\text{m}$?
- [ ] Does the exit edge point forward along the destination road ($\vec{v} \cdot \vec{d} > 0$)?
- [ ] Does A* pathfinding generate a smooth route across the shortcut in both directions?
- [ ] Do Vitest test suites and `pnpm run verify-graph` pass without warnings?
