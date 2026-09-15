# 🧭 San Andreas Pathfinder 3D

> 🇪🇸 [Leer en Español](./README.es.md)

Interactive web-based GPS navigator and route planner for **Grand Theft Auto: San Andreas**, powered by **React 19**, **TypeScript**, the **A\*** algorithm, 3D terrain elevation physics, and **Leaflet.js**.

![GTA San Andreas GPS Preview](src/assets/mapa-gta-sa-hd.webp)

---

## 🚀 Features

### 🗺️ Official Rockstar Games Road Network
- **28,991 vehicle nodes** and **59,620 directed road segments** extracted from the official `NODES.DAT` game files.
- Union-Find giant component guarantee: **27,083 connected nodes**, 0 dead-end orphans.

### ⚡ Ultra-Fast A\* Pathfinding Engine
- Pure TypeScript domain engine with a `MinHeap` priority queue and O(1) Spatial Hash Grid index.
- Cross-state path computation (e.g. San Fierro → Los Santos) in **~23 ms median**.
- Alternative routes sorted **by actual travel time** — the fastest option is always shown first.

### 🛣️ Smart Alternative Routes
- Up to 2 secondary routes discovered via dynamic edge-cost penalties and >70% edge-overlap filter.
- Each candidate is sorted by `totalTimeSeconds` so shorter alternatives are never buried below longer ones.

### 📍 Unlimited Multi-Stop Waypoints
- Add any number of stops: A → B → C → D …
- Real-time drag-and-drop marker relocation with instant path recomputation.

### ⛰️ 3D Elevation & Terrain Physics
- Real 3D Euclidean distances (ΔX, ΔY, ΔZ) with continuous slope curves.
- **5 vehicle profiles:** Standard Car, Sports Car, **Motorcycle (Recommended)**, Truck, 4×4 Off-Road.
- Live altimeter: total elevation gain/loss and altitude range above sea level.

### 🏍️ Curated Custom Shortcuts (6 routes)
- Player-recorded off-road trails and stunt circuits integrated into the road graph.
- **Unidirectional edge support:** cliff descents and stunt jumps flagged `oneWay: true` — the GPS will never route uphill through a physically impossible jump.
- 3-layer network architecture:
  - **Layer 1** — Official Rockstar nodes (`san_andreas_official_nodes.json`)
  - **Layer 2** — Official patch edges (`network_patches.json`) fixing 2 mapping errors in the original game data
  - **Layer 3** — Curated shortcuts (`shortcuts/` folder, one JSON per shortcut)

### 🔍 Landmark Place Search (POIs)
- Autocomplete with aliases (Grove Street, Airports, Mount Chiliad, Four Dragons Casino, etc.).

### 🌐 Bilingual Support & Shareable URLs
- Full Spanish (reference) and English translations.
- Bi-directional URL sync: `?w=2494,-1668;1707,-2438&r=0&v=bike&l=es`

---

## 🗂️ Project Structure

```
san-andreas-pathfinder-3d/
├── src/
│   ├── engine/          ★ Pure domain: MinHeap, RoadGraph (A*), types
│   ├── terrain/         ★ Pure domain: ElevationPhysics & vehicle profiles
│   ├── geo/             ★ Pure domain: Coordinate conversions & bounds
│   ├── map-bridge/      ★ Imperative Leaflet ↔ React bridge
│   ├── features/        ★ Search combobox, Route cards, Waypoints, URL state
│   ├── i18n/            ★ Typed ES/EN dictionaries & useTranslation hook
│   ├── ui/              ★ Global CSS tokens & handcrafted components
│   └── app/             ★ App shell & hooks
│
├── public/data/
│   ├── official/
│   │   └── san_andreas_official_nodes.json  # 28,991 nodes, 59,620 edges
│   ├── custom/
│   │   ├── network_patches.json             # 2 official mapping fix edges
│   │   └── shortcuts/
│   │       ├── manifest.json
│   │       ├── 1_glen_park_temple.json
│   │       ├── 2_marina_rodeo.json
│   │       ├── 3_mount_chiliad_whetstone.json  # oneWay: true (cliff descent)
│   │       ├── 4_san_fierro_doherty.json
│   │       ├── 5_flint_to_red_county.json
│   │       └── 6_flint_to_foster_valley.json  # oneWay: true (cliff descent)
│   └── pois.json
│
├── tools/
│   ├── verify-graph.ts      # Dataset invariants & giant component verifier
│   ├── bench-route.ts       # A* benchmark against recorded baseline
│   └── import-shortcuts.ts  # CLEO trajectory → shortcut JSON pipeline
│
├── .agent/skills/           # Agent skill documentation (curation, pathfinding…)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 💻 Development

Requirements: **Node.js ≥ 24.11.0** and **pnpm**.

```bash
# Install dependencies
pnpm install

# Start development server (HMR)
pnpm dev

# Run Vitest unit tests
pnpm test

# Verify graph dataset invariants
pnpm run verify-graph

# A* routing benchmark
pnpm run bench

# Production build
pnpm run build
```

---

## 🗺️ Coordinate System

| System | Description |
|--------|-------------|
| **GTA World Units** | Native coordinates from `NODES.DAT`. `X` = East/West, `Y` = North/South, `Z` = Altitude. |
| **Leaflet CRS.Simple** | `lat` maps to GTA `Y`, `lng` maps to GTA `X`. **Axes are swapped.** |

> ⚠️ `lat` is GTA `Y` and `lng` is GTA `X`. Every mirrored-marker bug is caused by this swap.

---

## 🏍️ Recommended Vehicle Profile

The **Motorcycle** profile (`bike`) is the default and recommended for all use cases.  
Its `slopeSensitivity: 0.5` makes it the most balanced profile across San Andreas's
varied terrain — it avoids over-penalizing steep hills while still respecting elevation
changes in travel-time estimates. Other profiles remain available in the UI selector.

---

## 🌐 Deploy

```bash
npx vercel
```

---

## 📜 License

MIT License. Map assets and road network data belong to **Rockstar Games**.

---

## 🎮 Custom Shortcut Recording Pipeline

Custom shortcuts are recorded directly in-game using two CLEO scripts compiled with [Sanny Builder](https://sannybuilder.com/) for **GTA:SA / SA-MP**.

### `tools/cleo/samp_coords_hud.txt` — Live Coordinates HUD

A lightweight CLEO script that renders the player's real-time GTA world coordinates (`X`, `Y`, `Z`) on screen while in-game.

| Key | Action |
|-----|--------|
| `K` or `H` | Toggle HUD on/off |

- Reads position via `store_actor` (safe for SA-MP, zero vehicle opcode usage).
- Display: Row 1 = X (white), Row 2 = Y (yellow), Row 3 = Z (cyan).
- Used to visually identify the **entry and exit snap nodes** for each shortcut.

---

### `tools/cleo/samp_shortcut_recorder.txt` — Trajectory Recorder

A CLEO script that records a continuous 3D trajectory (jumps, curves, off-road paths) and saves it to `cleo/shortcuts.ini` using the native `IniFiles.cleo` plugin. Zero open/close file handles, zero null pointers, zero crashes.

| Key | Action |
|-----|--------|
| `I` or `Ctrl+1` | Start recording (REC) |
| `O` or `Ctrl+2` | Stop and save trajectory (STOP) |

Output format (`shortcuts.ini`):
```ini
[1_pt]        ; total point count for shortcut #1
total = 40

[1_1]         ; point index within the shortcut
x = -1389.0
y = -1412.9
z = 106.4
```

Auto-samples every **10.0 meters** of movement or freefall, capturing the complete 3D shape of the trajectory.
The threshold lives in the `.cs` as `dist_sq >= 100.0`. Measured spacing across the imported shortcuts is
10.33 m mean / 10.30 m median — the overshoot is the ground covered inside one 10 ms script tick.
That matches the official network, whose median edge is 11.26 m (10.56 m over degree-2 corridors).

---

### Full Pipeline

```
In-Game Recording          Import Tool                  Router
──────────────────         ─────────────────────        ──────────────
samp_shortcut_recorder  →  tools/import-shortcuts.ts →  public/data/custom/
  (CLEO .cs)                 - snap to official nodes    shortcuts/<n>_name.json
  → cleo/shortcuts.ini       - copy points 1:1 (no resample)
                             - generate forward edges
                             - set oneWay flag if needed
```

> **Note:** `.txt` source files must be compiled to `.cs` using Sanny Builder before installation in the `CLEO/` game folder. See [`.agent/skills/cleo-sanny-builder/SKILL.md`](.agent/skills/cleo-sanny-builder/SKILL.md) for compilation instructions.
