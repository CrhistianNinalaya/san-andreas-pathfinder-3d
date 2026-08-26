# 🧭 San Andreas Pathfinder 3D

Interactive web-based GPS navigation and route planner for **Grand Theft Auto: San Andreas**, powered by **React 19**, **TypeScript**, the **A\*** algorithm, 3D terrain elevation physics, and **Leaflet.js**.

![GTA San Andreas GPS Preview](mapa-gta-sa-hd.webp)

---

## 🚀 Features

* **🗺️ Official Rockstar Games Road Network:**
  * **28,991 vehicle nodes** and **59,620 directed road segments** extracted from official `NODES.DAT` game files.
  * Union-Find giant component guarantee (27,083 connected nodes, 0 orphaned node dead-ends).
* **⚡ Ultra-Fast A\* Pathfinding Engine:**
  * Pure TypeScript domain engine with `MinHeap` and $O(1)$ Spatial Hash Grid index.
  * Cross-state path computation (e.g. San Fierro to Los Santos) in **~29 ms**.
* **🛣️ Alternative Routes:**
  * Automatically calculates the fastest primary route plus up to 2 secondary alternative routes via dynamic edge cost penalties.
* **📍 Unlimited Multi-Stop Waypoints:**
  * Add multiple stops seamlessly ($A \to B \to C \to D \dots$).
  * Real-time drag-and-drop marker relocation with instant path recomputation.
* **⛰️ 3D Elevation & Terrain Physics:**
  * Real 3D Euclidean distances $(\Delta X, \Delta Y, \Delta Z)$ and continuous slope curves.
  * 5 Vehicle profiles: Standard Car, Sports Car, Motorcycle, Truck, and 4x4 Off-Road.
  * Live altimeter metrics: total elevation gain/loss and altitude range (meters above sea level).
* **🔍 Landmark Place Search (POIs):**
  * Intelligent search with autocomplete and aliases (Grove Street, Airports, Mount Chiliad, Four Dragons Casino, etc.).
* **🌐 Bilingual Support & Shareable URLs:**
  * Full Spanish (reference) and English translations.
  * Bi-directional URL synchronization (`?w=2494,-1668;1707,-2438&r=0&v=sports&l=es`).

---

## 🛠️ Project Structure

```text
san-andreas-pathfinder-3d/
├── src/
│   ├── engine/          ★ Pure domain: MinHeap, RoadGraph (A*), types
│   ├── terrain/         ★ Pure domain: ElevationPhysics & vehicle profiles
│   ├── geo/             ★ Pure domain: Coordinates & bounds conversions
│   ├── map-bridge/      ★ Imperative Leaflet ↔ React Bridge
│   ├── features/        ★ Search, Route cards, Waypoint list, URL state
│   ├── i18n/            ★ Typed ES / EN dictionaries & useTranslation
│   ├── ui/              ★ Global CSS and handcrafted UI components
│   └── app/             ★ Shell & App.tsx
│
├── data/
│   ├── san_andreas_official_nodes.json  # Full state road network (28,991 nodes)
│   └── pois.json                        # Landmark locations and search aliases
├── tools/
│   ├── verify-graph.mjs # Invariants & giant component verifier
│   └── bench-route.mjs  # A* benchmark against recorded baseline
│
├── vite.config.ts
├── tsconfig.json
├── package.json
└── vercel.json
```

---

## 💻 Development with pnpm

Requirements: **Node.js >= 24.11.0** and **pnpm >= 9.0.0**.

```bash
# Install dependencies
pnpm install

# Start development server with instant HMR
pnpm dev

# Run Vitest unit tests
pnpm test

# Run graph invariant verifier
pnpm run verify-graph

# Run A* routing benchmark
pnpm run bench

# Build for production
pnpm run build
```

---

## 🌐 Deploy to Vercel

```bash
npx vercel
```

---

## 📜 License

MIT License. Map assets and road nodes belong to Rockstar Games.
