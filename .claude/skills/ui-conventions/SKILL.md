---
name: ui-conventions
description: Frontend conventions for this project — React + TypeScript with no UI libraries, the Leaflet-to-React bridge pattern, state and URL handling, CSS Modules, the Web Worker protocol, and i18n. Use when writing or reviewing any component, hook, style, worker message, or anything under apps/web or libs/ui, libs/map-bridge, libs/i18n.
---

# Frontend conventions

## The constraint

**No libraries for the UI layer.** Components, panels, inputs, sheets, comboboxes, modals, layout —
hand-written.

Libraries are fine *outside* the UI: Leaflet, Vite, Vitest, React itself. The line is "does this
render chrome for us?" If yes, we write it.

Concretely rejected: MUI, Chakra, shadcn/ui, Ant, Tailwind, react-select, cmdk, vaul, react-modal,
framer-motion, react-leaflet, react-router, i18next.

The whole UI is one floating panel, a waypoint list, some buttons, and a combobox. That is a few
hundred lines of our own code, not 200 KB of someone else's.

## Stack

React 19 · TypeScript `strict` + `noUncheckedIndexedAccess` · Vite · CSS Modules · Vitest ·
Biome (lint + format).

`any` is banned in `libs/`. The engine indexes typed arrays constantly — `noUncheckedIndexedAccess`
is on precisely because it catches the resulting off-by-ones.

## The Leaflet bridge — the pattern that decides whether this app is maintainable

Leaflet is imperative and owns mutable map state. React is declarative. Mixing them badly is the
classic failure mode of map apps. One pattern, no exceptions:

**1. React never re-renders the map.** One effect with an empty dep array creates the Leaflet
instance and hands it out through context. It is created once and destroyed once.

**2. Layers are managed by effects keyed on data, never expressed as JSX.**

```tsx
function useRouteLayer(map: L.Map, route: Route | null) {
  const layerRef = useRef<L.Polyline | null>(null);
  useEffect(() => {
    layerRef.current?.remove();
    if (!route) return;
    layerRef.current = L.polyline(route.path.map(gtaToLatLng)).addTo(map);
    return () => { layerRef.current?.remove(); };
  }, [map, route]);
}
```

**3. Events flow Leaflet → React, never the reverse.** `map.on('click')` dispatches
`WAYPOINT_ADDED`. React state is the single source of truth; markers are a projection of it. A
marker never holds state the reducer doesn't have.

**4. `libs/map-bridge` is the only package that may `import 'leaflet'`.** Nx boundary lint enforces
it. Everything else works in GTA world coordinates — see the `sa-coordinates` skill.

## State

**Route state** — waypoints, active alternative, vehicle profile, scope — is one `useReducer` in a
context. It's a small state machine, and a reducer makes it testable and makes URL serialisation a
pure function of state.

**Graph state** — loading / ready / error, plus the worker handle — is `useSyncExternalStore` over
the worker client. Correct under concurrent rendering, no dependency.

**No `useEffect` for derived values.** If it can be computed during render, compute it during render.

Revisit Zustand only if the reducer passes ~200 lines. Not before.

## URL is state

Every route is a shareable URL (SPEC.md §7.1):

```
?w=2494,-1668;1707,-2438 &r=1 &v=car &l=es
```

- Parse on boot **before** the graph loads. The URL is authoritative.
- Write with `history.replaceState` on **committed** changes only — never on every drag frame.
- Store **world coordinates, never node ids**. Ids change on every dataset rebuild.
- Round to integers. Cap at 26 waypoints (the A–Z labels assume it).

## Components

- Function components, named exports, one component per file.
- Props typed with an explicit `interface`. No `React.FC`.
- Composition over configuration: `<Panel><Panel.Header/></Panel>`, not `<Panel headerTitle=... />`.
- Accessibility is not optional: real `<button>` elements, keyboard navigation, `aria-live` for
  route results, visible focus. The combobox needs full `role="combobox"` semantics — that's most of
  why it's 120 lines instead of 20.
- **No `dangerouslySetInnerHTML`.** The old code has twelve `innerHTML =` sites; they are safe only
  because the dataset has no strings. POI names arrive in Phase 4 and every one of them becomes an
  injection site.

## Styles

CSS Modules, one `.module.css` per component. Design tokens as custom properties on `:root` — the
existing palette (`#38bdf8` accent, `#12151c` surface, slate greys) is good, it just isn't tokenised.

No inline `style` attributes. The current code has them in `index.html` and inside `app.js` string
templates, next to a stylesheet that already defines classes for the same thing. The only legitimate
inline style is a genuinely dynamic value — a computed transform, a chart path length.

## Worker protocol

Hand-written and typed. Three messages, a discriminated union, no Comlink:

```ts
type ToWorker =
  | { type: 'load'; url: string }
  | { type: 'route'; from: WorldPos; to: WorldPos; profile: VehicleProfile; alternatives: number }
  | { type: 'nearest'; at: WorldPos };

type FromWorker =
  | { type: 'ready'; nodeCount: number; components: number }
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'routed'; requestId: number; routes: Route[] }
  | { type: 'error'; message: string };
```

- Transfer the `ArrayBuffer`, don't clone it.
- Every request carries a `requestId`; drop responses that arrive after a newer request. Dragging a
  marker fires many requests and stale replies must not win.
- The worker never formats and never sees a `LatLng`.

## i18n

`libs/i18n`: `const dict = { es: {...}, en: {...} } as const` plus a `useTranslation()` hook.
`keyof typeof dict.en` gives compile-time key checking and autocomplete — strictly better than
i18next for 80 strings, at 40 lines.

**Spanish is the reference translation**; English follows it. The audience is majority
Spanish-speaking. Language comes from `navigator.language`, is overridable via `?l=`, and persists in
`localStorage`.

Code, comments, commit messages, and docs stay in **English** (repo convention since commit
`2d7cbd4`). Only user-facing strings are translated, and they live in the dictionary — never inline
in a component.

## Performance budgets

Enforced in CI (SPEC.md §10): 120 KB brotli JS excluding the graph · longest boot task under 50 ms ·
TTI under 1.5 s on simulated 4G · marker drag to repaint in one frame.

If a change adds a dependency, check the budget before adding it.
