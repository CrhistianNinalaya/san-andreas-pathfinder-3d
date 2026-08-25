---
description: Serve the app, open it in the browser, and verify routing actually works end to end.
argument-hint: "[what to verify, e.g. 'the reverse button']"
allowed-tools: mcp__Claude_Browser__*, Read, Grep, Glob, Bash(npx serve:*), Bash(npx nx:*)
---

Run the app and verify it in a real browser. `$ARGUMENTS` is what to check; with no argument, run
the smoke path below.

## Start it

Pre-migration the app is static files — no build step. Post-migration (Phase 1+) it is `nx serve web`.
Check for `nx.json` and pick accordingly, then use `preview_start` with the resulting URL rather than
launching a server from Bash.

Note: `npm start` in `package.json` runs `python3 -m http.server`, which does not work on this
Windows machine. Use `npx serve .` instead. Fixing that script is a Phase 0 task.

## Smoke path

1. Map renders; the badge settles on the node count instead of "Loading network...".
2. Click two points in Los Santos → a cyan route appears with distance, time, and elevation.
3. Click a third point → the panel switches to a multi-stop summary with per-leg breakdown.
4. Drag a marker → the route recalculates.
5. Toggle "Show road network nodes" → dots appear.

## Watch for these specifically

These are known-broken (`docs/CODE-REVIEW.md`) and easy to mistake for something new:

- **Switching the network scope strands the waypoints** (P0-1). After switching to San Fierro, every
  existing route reports "No road connection found" because the node ids belong to the previous
  graph. Expected until Phase 0 lands.
- **Some clicks are genuinely unroutable** (P0-2). 6.6% of nodes sit in orphaned components. Before
  filing this as a bug, confirm with `/verify-graph` that the endpoint is in a small component.
- **Multi-stop totals can be silently wrong** (P0-3). If a leg fails it is dropped from the total but
  the summary still says "Total Route". Cross-check the sum of the legs against the headline number.
- **Panning does not refresh the debug layer** (P1-5), and it caps at 1,500 nodes with no indication.

Read the console. A silent failure here looks exactly like a working app.

## Report

What you did, what you saw, and — for anything broken — whether it is one of the known findings above
or something new. Screenshot only when the visual result is the point.
