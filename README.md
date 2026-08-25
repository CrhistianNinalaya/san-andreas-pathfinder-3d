# 🧭 San Andreas GPS - 3D Route Planner & Navigator

Interactive web-based GPS navigation and route planner for **Grand Theft Auto: San Andreas**, powered by the **A\*** (A-Star) algorithm, Graph Theory, 3D terrain elevation physics, and **Leaflet.js**.

![GTA San Andreas GPS Preview](mapa-gta-sa-hd.webp)

---

## 🚀 Features

* **🗺️ Official Rockstar Games Road Network:**
  * **28,991 vehicle nodes** and **59,620 directed road segments** extracted from official `NODES.DAT` game files.
  * Complete state coverage: Los Santos, San Fierro, Las Venturas, Red County, Flint County, Bone County, Tierra Robada, and Whetstone.
* **⚡ Ultra-Fast A\* Pathfinding Engine:**
  * Optimized with `MinHeap` and $O(1)$ Spatial Hash Grid index.
  * Cross-state path computation (e.g. San Fierro to Los Santos) in **~100 ms**.
* **🛣️ Alternative Routes:**
  * Automatically calculates the fastest primary route plus up to 2 secondary alternative routes via dynamic edge cost penalties.
* **📍 Unlimited Multi-Stop Waypoints:**
  * Add multiple stops seamlessly ($A \to B \to C \to D \dots$).
  * Comprehensive total trip summary and leg-by-leg breakdowns.
* **⛰️ 3D Elevation & Terrain Physics:**
  * Real 3D Euclidean distances $(\Delta X, \Delta Y, \Delta Z)$.
  * Slope/gradient penalties (engine powertrain drop on steep climbs and gravitational gain on gentle descents).
  * Live altimeter metrics: total elevation gain/loss and altitude range (meters above sea level).
* **🎨 Modern Interactive Web Interface:**
  * Ultra HD ($6144 \times 6144\text{ px}$) map rendered from the 144 official in-game radar `.txd` tiles.
  * Draggable markers with instant real-time route recalculation.
  * Live coordinate inspector $(X, Y)$ on cursor hover.

---

## 🛠️ Project Structure

```text
├── index.html              # Main web interface
├── package.json            # Project metadata & scripts
├── vercel.json             # Vercel deployment configuration
├── .gitignore              # Git ignore rules
│
├── css/
│   └── style.css           # Dark theme with glassmorphism UI
│
├── js/
│   ├── map-config.js       # Leaflet coordinate calibration & bounds
│   ├── elevation-cost.js   # 3D elevation physics & slope evaluation
│   ├── pathfinder.js       # A* engine with MinHeap & alternative routes
│   └── app.js              # UI controller, waypoints & event handlers
│
└── data/
    ├── san_andreas_official_nodes.json  # Full state road network (28,991 nodes)
    └── san_fierro_official_nodes.json   # San Fierro subset (6,217 nodes)
```

---

## 💻 Local Setup

Run with any local HTTP server:

```bash
# Python
python3 -m http.server 8080

# Or Node.js
npx serve .
```

Open in your browser: `http://localhost:8080`

---

## 🌐 Deploy to Vercel

```bash
npx vercel
```

---

## 📜 License

MIT License. Map assets and road nodes belong to Rockstar Games.
