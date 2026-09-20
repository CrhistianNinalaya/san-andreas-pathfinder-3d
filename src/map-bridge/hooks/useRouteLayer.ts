import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { RouteResult } from '../../engine/types';
import { renderRoutesToLayer } from '../utils/route-layer/routeLayerRenderer';

/**
 * Options for the route rendering layer hook.
 */
export interface UseRouteLayerOptions {
  map: L.Map | null;
  routes: RouteResult[];
  activeRouteIndex: number;
  onSelectAlternative?: (index: number) => void;
}

/**
 * Renders calculated driving paths and alternatives on the Leaflet map.
 */
export function useRouteLayer(options: Readonly<UseRouteLayerOptions>) {
  const { map, routes, activeRouteIndex, onSelectAlternative } = options;
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    layerGroupRef.current ??= L.layerGroup().addTo(map);
    const group = layerGroupRef.current;
    group.clearLayers();

    renderRoutesToLayer({ group, routes, activeRouteIndex, onSelectAlternative });
  }, [map, routes, activeRouteIndex, onSelectAlternative]);
}
