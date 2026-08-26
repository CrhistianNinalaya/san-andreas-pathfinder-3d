import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { gtaToLatLng } from '../geo/coordinates';
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

    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    const group = layerGroupRef.current;
    group.clearLayers();

    if (routes.length === 0) return;

    // Draw alternative routes (dashed gray lines)
    routes.forEach((route, idx) => {
      if (idx === activeRouteIndex) return;

      const latlngs = route.path.map(n => gtaToLatLng(n.x, n.y));
      const line = L.polyline(latlngs, {
        color: '#64748b',
        weight: 6,
        opacity: 0.6,
        dashArray: '6, 8',
        lineCap: 'round'
      });

      line.on('click', () => {
        if (onSelectAlternative) onSelectAlternative(idx);
      });

      line.addTo(group);
    });

    // Draw active primary route (glow + bright cyan line)
    const active = routes[activeRouteIndex];
    if (active) {
      const latlngs = active.path.map(n => gtaToLatLng(n.x, n.y));

      const glow = L.polyline(latlngs, {
        color: '#0284c7',
        weight: 10,
        opacity: 0.4,
        lineCap: 'round'
      });
      glow.addTo(group);

      const mainLine = L.polyline(latlngs, {
        color: '#38bdf8',
        weight: 5,
        opacity: 1.0,
        lineCap: 'round'
      });
      mainLine.addTo(group);
    }
  }, [map, routes, activeRouteIndex, onSelectAlternative]);
}
