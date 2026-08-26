/**
 * Canonical Responsive Breakpoints & Media Queries
 * Used for programmatic viewport queries and JS matchMedia listeners.
 */

export const BREAKPOINTS = {
  mobile: '768px',
  tablet: '1024px',
  desktop: '1280px'
} as const;

export const MEDIA_QUERIES = {
  mobile: '(max-width: 768px)',
  tablet: '(max-width: 1024px)',
  desktop: '(min-width: 769px)'
} as const;
