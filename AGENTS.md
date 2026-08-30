# San Andreas Pathfinder 3D

A\* route planner over the official GTA:SA road network, with 3D terrain physics, on a Leaflet map.

**Current state:** React 19 + TypeScript + Vite application.

## Constraints

- **No libraries for the UI layer.** Components, panels, inputs, sheets, comboboxes are hand-written with CSS Modules.
- **Leaflet stays.** The map engine is wrapped via the imperative bridge pattern (`src/map-bridge/`).
- **React 19 + TypeScript**, `strict` + `noUncheckedIndexedAccess`. No `any` in engine modules.
- **No Non-Null Assertions (!):** The non-null assertion operator `!` (e.g. `array[i]!`, `map.get(...)!`) is strictly forbidden. Do not bypass TypeScript's type checker with "trust me". Use explicit defensive guards (`if (!item) return/continue`), safe narrowing, or fallback defaults (`??`) to guarantee true runtime safety.
- **Package Manager:** `pnpm` with **Node.js >= 24.11.0**.
- **Pure domain separation:** `src/engine/`, `src/terrain/`, and `src/geo/` have zero imports of React, Leaflet, or the DOM.
- **Max 2 positional parameters:** Any function or hook that takes more than 2 parameters must receive an options object `{ ... }` for clarity and maintainability.
- **Readonly React Props:** All component and hook prop interfaces must be wrapped with TypeScript's `Readonly<Props>` utility type: `export function MyComponent({ ... }: Readonly<MyComponentProps>)`.
- **Function Declarations:** Always declare components, custom hooks, and helper functions using standard `function` keyword declarations (`export function MyComponent(...) { ... }`) rather than arrow function variable assignments (`const MyComponent = ...`).
- **Component Folder Architecture:**
  - `index.tsx` (view render) and `[Name].module.css` (scoped styles).
  - `types.ts` is created only when props $> 4$ (if $\le 4$, define the interface inline in `index.tsx`).
  - Component-specific hooks live in `hooks/` with single responsibility.
  - Component pure helper functions live in `utils/`.
- **CSS Custom Properties (Design Tokens):** All UI styling (colors, backgrounds, borders, shadows, radii, font sizes, transitions, z-indices) must strictly use CSS variables (`var(--...)`) defined in `src/ui/global.css`. Never use raw hardcoded hex/rgb/rgba values in CSS Modules or components.
- **Clean Code & Linter Invariants:**
  - **No Nested Ternaries:** Never nest ternary expressions (`a ? b : c ? d : e`). Extract them into independent statements or early-return functions.
  - **Standard Global Built-ins:** Prefer `Number.parseInt` over `parseInt` and `Number.parseFloat` over `parseFloat`.
  - **Regex Method:** Use `RegExp.exec()` rather than `String.prototype.match()`.
  - **Optional Chaining:** Prefer optional chaining expressions (`obj?.prop`, `arr?.[i]`) over verbose logical AND chains (`obj && obj.prop`).
  - **Single Array Push:** Do not call `Array#push()` multiple times consecutively; combine them into a single call: `arr.push(itemA, itemB)`.
  - **Relative Indexing:** Prefer `arr.at(-1)` / `arr.at(0)` over `arr[arr.length - 1]` or index math.
- **Responsive Breakpoints:**
  - Mobile bottom sheet / touch layout: `@media (max-width: 768px)` (canonical standard defined in `src/ui/breakpoints.ts` and `src/ui/global.css`).

## Layout

```
src/
  engine/       MinHeap, RoadGraph (A*), types (pure TS)
  terrain/      ElevationPhysics, vehicle profiles (pure TS)
  geo/          Coordinate math and Leaflet conversions (pure TS)
  map-bridge/   Leaflet ↔ React Bridge hooks and MapView
  features/     Search combobox, Waypoints list, Route cards, URL state
  i18n/         Typed bilingual dictionaries (ES/EN)
  ui/           Handcrafted UI styles
  app/          Main App container
public/data/    san_andreas_official_nodes.json, pois.json
tools/          verify-graph.mjs, bench-route.ts
.agent/         skills/ and workflows/
```

## Before you change something

```bash
pnpm run verify-graph     # dataset invariants + connectivity
pnpm run bench            # A* timings against the recorded baseline
pnpm test                 # Vitest pure domain test suite
pnpm run build            # Production TypeScript + Vite build
```

## Things that will mislead you

- **6.6% of road nodes cannot reach the rest of the map in raw data.** The engine uses Union-Find to snap strictly into the giant component (27,083 nodes).
- **`lat` is GTA `y` and `lng` is GTA `x`.** Every mirrored-marker bug is this swap.
- **The A\* heuristic's admissibility margin is guaranteed dynamically** (`maxSpeed * 1.10 + 1`).
- **Node ids change on every dataset rebuild.** Never persist one — persist world coordinates.

## Conventions

Code, comments, commits, and docs in **English**. User-facing strings are
translated ES/EN and live in `src/i18n` — Spanish is the reference translation.

## Skills

`gta-graph-data` · `pathfinding-engine` · `sa-coordinates` · `ui-conventions` · `cleo-sanny-builder` · `shortcut-curation`
