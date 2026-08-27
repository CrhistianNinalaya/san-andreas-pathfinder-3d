import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { gtaToLatLng } from '../geo/coordinates';
import { partitionLegSegments } from './utils/routeOverlap';
import { ROUTE_PALETTE } from './theme';
import type { RouteResult } from '../engine/types';

export interface UseRouteLayerOptions {
  map: L.Map | null;
  routes: RouteResult[];
  activeRouteIndex: number;
  onSelectAlternative?: (index: number) => void;
}

export function useRouteLayer(options: Readonly<UseRouteLayerOptions>) {
  const { map, routes, activeRouteIndex, onSelectAlternative } = options;
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    layerGroupRef.current ??= L.layerGroup().addTo(map);
    const group = layerGroupRef.current;
    group.clearLayers();

    if (routes.length === 0) return;

    // Draw alternative routes (thin dashed gray lines)
    routes.forEach((route, idx) => {
      if (idx === activeRouteIndex) return;

      const latlngs = route.path.map(n => gtaToLatLng(n.x, n.y));
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

    // Draw active primary route
    const active = routes[activeRouteIndex];
    if (active) {
      if (active.legs && active.legs.length > 1) {
        // Multi-Stop Route: Render with intelligent overlap detection
        const segments = partitionLegSegments(active.legs);

        segments.forEach((seg) => {
          const colorPair = ROUTE_PALETTE.legs[seg.legIndex % ROUTE_PALETTE.legs.length] ?? ROUTE_PALETTE.primary;
          const dashPattern = seg.isOverlapping ? '10, 10' : undefined;

          // Contrast casing outline
          const casing = L.polyline(seg.latlngs, {
            color: colorPair.casing,
            weight: 5.5,
            opacity: 0.85,
            dashArray: dashPattern,
            lineCap: 'round',
            lineJoin: 'round'
          });
          casing.addTo(group);

          // Colored route leg line (Solid for solo roads, Dashed for shared roads)
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
      } else {
        // Single Direct Route (A -> B): Glow + Sharp Cyan
        const latlngs = active.path.map(n => gtaToLatLng(n.x, n.y));

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
    }
  }, [map, routes, activeRouteIndex, onSelectAlternative]);
}
