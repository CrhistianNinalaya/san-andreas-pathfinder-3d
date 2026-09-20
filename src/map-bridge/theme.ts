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
  successDark: '#047857',
  successLight: '#34d399',
  gold: '#fbbf24',
  goldDark: '#b45309',
  warning: '#f59e0b',
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
  },
  patch: {
    radius: 3.5,
    weight: 2,
    color: MAP_TOKENS.successDark,
    fillColor: MAP_TOKENS.success,
    fillOpacity: 1.0
  },
  shortcut: {
    radius: 3.5,
    weight: 2,
    color: MAP_TOKENS.goldDark,
    fillColor: MAP_TOKENS.gold,
    fillOpacity: 1.0
  },
  coincident: {
    radius: 8,
    weight: 2.5,
    color: '#f43f5e',
    fillColor: '#fda4af',
    fillOpacity: 0.45,
    titleColor: '#e11d48'
  }
} as const;

export const ROUTE_PALETTE = {
  primary: { main: '#38bdf8', glow: '#0284c7', casing: '#082f49' },
  alternative: { color: MAP_TOKENS.muted },
  legs: [
    { main: '#38bdf8', casing: '#082f49' },
    { main: '#34d399', casing: '#022c22' },
    { main: '#fbbf24', casing: '#451a03' },
    { main: '#c084fc', casing: '#3b0764' },
    { main: '#fb7185', casing: '#4c0519' }
  ]
} as const;
