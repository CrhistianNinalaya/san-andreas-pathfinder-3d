---
name: sa-coordinates
description: The three coordinate systems in this project — GTA world units, Leaflet CRS.Simple lat/lng, and map image pixels — and the axis-swap between them. Use whenever converting positions, placing markers or polylines, computing map bounds, reading mouse position, slicing tiles, or when something renders mirrored, rotated, or offset on the map.
---

# Coordinates

Three systems. Two conversions. One axis swap that will bite anyone who forgets it.

## The systems

**1. GTA world units** — the only system the domain code should ever see.

```
x: [-3000, 3000]   West  → East
y: [-3000, 3000]   South → North
z: elevation, roughly [-100, 500]
```

Not metres. The UI presents them as metres deliberately (SPEC.md D5) — that is a modelling choice,
not a fact about the game.

**2. Leaflet `CRS.Simple`** — `[lat, lng]`, and here is the swap:

```
lat  =  GTA y        (vertical)
lng  =  GTA x        (horizontal)
```

**Leaflet puts the vertical axis first. GTA world coordinates put the horizontal axis first.**
Every mirrored route, every marker in the wrong quadrant, every "the map is rotated" bug traces
back to this line. It is the single highest-frequency mistake in this codebase.

**3. Image pixels** — the radar map is 6144×6144, origin **top-left**, `y` growing **downward**.
GTA `y` grows **upward**. Converting to pixels means flipping `y`, not just scaling it.

```
px = (x + 3000) / 6000 * 6144
py = (3000 - y) / 6000 * 6144       ← note the flip
```

Only tile generation and any raster work need this. Nothing at runtime should.

## The conversion boundary

All of it lives in `GTA_MAP_CONFIG` (`js/map-config.js`, later `libs/geo`). That is deliberate:

> **Only `libs/geo` and `libs/map-bridge` may hold a `LatLng`. Everything else works in
> GTA world coordinates.**

`libs/pathfinding`, `libs/terrain`, the route reducer, the URL serialiser, the POI dataset — all
world coordinates, all the time. If a `LatLng` appears in a domain module, the boundary leaked.

```js
GTA_MAP_CONFIG.latLngToGta(latlng)  // → { x, y }   rounds to integers
GTA_MAP_CONFIG.gtaToLatLng(x, y)    // → [y, x]     the swap, in one place
```

Note `latLngToGta` **rounds**. Fine for click targets and URL state (SPEC.md §7.1 stores integers);
wrong if you ever need sub-unit precision. It does not carry `z` — elevation comes from the snapped
graph node, never from the map.

## Bounds

```js
bounds: [[-3000, -3000], [3000, 3000]]   // [[minY, minX], [maxY, maxX]] — lat first
```

Used for the image overlay and for `maxBounds`. Getting the order wrong here produces a map that
looks correct until you pan.

The map currently sets no `maxBounds`, so you can pan into infinite grey void. Setting it is a
one-line fix.

## Zoom

`CRS.Simple` with `minZoom: -2, maxZoom: 4`. **Negative zoom is normal here** — at zoom 0 one world
unit is one pixel, which makes the 6000-unit map 6000 px wide. Zoom -1 fits roughly a full screen.

`zoom: -1` is the "whole state" view. It is in `GTA_MAP_CONFIG.defaultView` — use that constant, do
not hardcode `map.setView([0, 0], -1)` (`app.js:507` currently does).

## Debugging a position bug

In order:

1. **Is it mirrored across the diagonal?** You swapped `lat`/`lng`. Almost always this.
2. **Is it mirrored vertically only?** You forgot the `y` flip in a pixel conversion.
3. **Is it offset by a constant?** Wrong origin — world space is centred on 0, image space on the
   top-left corner.
4. **Is it at the right place but the wrong scale?** `6000` world units map to `6144` px, not 6000.

## Adding a new coordinate consumer

Tile pyramids, minimaps, exported images, screenshot overlays — each needs its own conversion. Put
it in `libs/geo` next to the others, name it after both spaces (`gtaToTile`, `gtaToImagePixel`), and
give it a round-trip test. Two-way conversions that don't round-trip are how offsets creep in.
