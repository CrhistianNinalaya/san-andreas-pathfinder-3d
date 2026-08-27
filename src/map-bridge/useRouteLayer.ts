import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { gtaToLatLng } from '../geo/coordinates';
import { partitionLegSegments } from './utils/routeOverlap';
import type { RouteResult } from '../engine/types';

export interface UseRouteLayerOptions {
  map: L.Map | null;
  routes: RouteResult[];
  activeRouteIndex: number;
  onSelectAlternative?: (index: number) => void;
}

const LEG_PALETTE = [
  { main: '#38bdf8', casing: '#082f49' }, // Cyan (Leg 1: A -> B)
  { main: '#34d399', casing: '#022c22' }, // Emerald (Leg 2: B -> C)
  { main: '#fbbf24', casing: '#451a03' }, // Amber (Leg 3: C -> D)
  { main: '#c084fc', casing: '#3b0764' }, // Violet (Leg 4: D -> E)
  { main: '#fb7185', casing: '#4c0519' }  // Rose (Leg 5: E -> F)
];

export function useRouteLayer(options: Readonly<UseRouteLayerOptions>) {
  const { map, routes, activeRouteIndex, onSelectAlternative } = options;
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    const group = layerGroupRef.current;
    group.clearLayers();

    if (routes.length === 0) return;

    // Draw alternative routes (thin dashed gray lines)
    routes.forEach((route, idx) => {
      if (idx === activeRouteIndex) return;

      const latlngs = route.path.map(n => gtaToLatLng(n.x, n.y));
      const line = L.polyline(latlngs, {
        color: '#64748b',
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
        // Unique road spans are 100% SOLID. Overlapping road spans are DASHED to reveal previous leg color.
        const segments = partitionLegSegments(active.legs);

        segments.forEach((seg) => {
          const colorPair = LEG_PALETTE[seg.legIndex % LEG_PALETTE.length] ?? { main: '#38bdf8', casing: '#082f49' };
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
          color: '#0284c7',
          weight: 6,
          opacity: 0.4,
          lineCap: 'round',
          lineJoin: 'round'
        });
        glow.addTo(group);

        const mainLine = L.polyline(latlngs, {
          color: '#38bdf8',
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
