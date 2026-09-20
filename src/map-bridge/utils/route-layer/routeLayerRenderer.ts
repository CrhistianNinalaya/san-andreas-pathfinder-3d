import L from 'leaflet';
import { gtaToLatLng } from '../../../geo/coordinates';
import { partitionLegSegments } from '../routeOverlap';
import { ROUTE_PALETTE } from '../../theme';
import type { RouteResult } from '../../../engine/types';

export interface RenderAlternativesOptions {
  group: L.LayerGroup;
  routes: RouteResult[];
  activeRouteIndex: number;
  onSelectAlternative?: (index: number) => void;
}

export interface RenderRoutesLayerOptions {
  group: L.LayerGroup;
  routes: RouteResult[];
  activeRouteIndex: number;
  onSelectAlternative?: (index: number) => void;
}

/**
 * Renders dashed polylines for unselected alternative routes.
 */
export function renderAlternativeRoutes(options: Readonly<RenderAlternativesOptions>): void {
  const { group, routes, activeRouteIndex, onSelectAlternative } = options;

  routes.forEach((route, idx) => {
    if (idx === activeRouteIndex) return;

    const latlngs = route.path.map((n) => gtaToLatLng(n.x, n.y));
    const line = L.polyline(latlngs, {
      color: ROUTE_PALETTE.alternative.color,
      weight: 3,
      opacity: 0.6,
      dashArray: '5, 7',
      lineCap: 'round',
      lineJoin: 'round'
    });

    line.on('click', () => {
      if (onSelectAlternative) onSelectAlternative(idx);
    });

    line.addTo(group);
  });
}

/**
 * Renders multi-stop route legs with overlap casing and dashing.
 */
export function renderMultiStopRoute(group: L.LayerGroup, active: RouteResult): void {
  if (!active.legs) return;
  const segments = partitionLegSegments(active.legs);

  segments.forEach((seg) => {
    const colorPair = ROUTE_PALETTE.legs[seg.legIndex % ROUTE_PALETTE.legs.length] ?? ROUTE_PALETTE.primary;
    const dashPattern = seg.isOverlapping ? '10, 10' : undefined;

    const casing = L.polyline(seg.latlngs, {
      color: colorPair.casing,
      weight: 5.5,
      opacity: 0.85,
      dashArray: dashPattern,
      lineCap: 'round',
      lineJoin: 'round'
    });
    casing.addTo(group);

    const legLine = L.polyline(seg.latlngs, {
      color: colorPair.main,
      weight: 3.5,
      opacity: 1.0,
      dashArray: dashPattern,
      lineCap: 'round',
      lineJoin: 'round'
    });
    legLine.addTo(group);
  });
}

/**
 * Renders a single direct route polyline with glow effect.
 */
export function renderDirectRoute(group: L.LayerGroup, active: RouteResult): void {
  const latlngs = active.path.map((n) => gtaToLatLng(n.x, n.y));

  const glow = L.polyline(latlngs, {
    color: ROUTE_PALETTE.primary.glow,
    weight: 6,
    opacity: 0.4,
    lineCap: 'round',
    lineJoin: 'round'
  });
  glow.addTo(group);

  const mainLine = L.polyline(latlngs, {
    color: ROUTE_PALETTE.primary.main,
    weight: 3.5,
    opacity: 1.0,
    lineCap: 'round',
    lineJoin: 'round'
  });
  mainLine.addTo(group);
}

/**
 * Renders the primary active route path onto the Leaflet layer group.
 */
export function renderActiveRoute(group: L.LayerGroup, active: RouteResult): void {
  if (active.legs && active.legs.length > 1) {
    renderMultiStopRoute(group, active);
    return;
  }
  renderDirectRoute(group, active);
}

/**
 * Renders all routes (active and alternatives) onto the Leaflet layer group.
 */
export function renderRoutesToLayer(options: Readonly<RenderRoutesLayerOptions>): void {
  const { group, routes, activeRouteIndex, onSelectAlternative } = options;
  if (routes.length === 0) return;

  renderAlternativeRoutes({ group, routes, activeRouteIndex, onSelectAlternative });

  const active = routes[activeRouteIndex];
  if (active) {
    renderActiveRoute(group, active);
  }
}
