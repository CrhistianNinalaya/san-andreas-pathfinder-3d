/**
 * Map Bridge Theme Tokens
 * Centralized design tokens for Leaflet vector layers matching src/ui/global.css
 */

export const MAP_TOKENS = {
  primary: '#0284c7',
  accent: '#38bdf8',
  danger: '#ef4444',
  dangerLight: '#f87171',
  success: '#10b981',
  muted: '#64748b'
} as const;

export const NODE_LAYER_THEME = {
  giant: {
    radius: 1.75,
    weight: 1,
    color: MAP_TOKENS.primary,
    fillColor: MAP_TOKENS.accent,
    fillOpacity: 0.65
  },
  isolated: {
    radius: 2.5,
    weight: 1,
    color: MAP_TOKENS.danger,
    fillColor: MAP_TOKENS.dangerLight,
    fillOpacity: 0.9
  }
} as const;

export const ROUTE_PALETTE = {
  primary: { main: '#38bdf8', glow: '#0284c7', casing: '#082f49' },
  alternative: { color: MAP_TOKENS.muted },
  legs: [
    { main: '#38bdf8', casing: '#082f49' }, // Cyan (Leg 1: A -> B)
    { main: '#34d399', casing: '#022c22' }, // Emerald (Leg 2: B -> C)
    { main: '#fbbf24', casing: '#451a03' }, // Amber (Leg 3: C -> D)
    { main: '#c084fc', casing: '#3b0764' }, // Violet (Leg 4: D -> E)
    { main: '#fb7185', casing: '#4c0519' }  // Rose (Leg 5: E -> F)
  ]
} as const;
