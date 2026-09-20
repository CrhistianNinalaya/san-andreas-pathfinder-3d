import { useEffect } from 'react';
import { useMapBridge } from '../../../map-bridge/hooks/useMapBridge';
import { useRouteLayer } from '../../../map-bridge/hooks/useRouteLayer';
import { useWaypointMarkers } from '../../../map-bridge/hooks/useWaypointMarkers';
import { useNodesLayer } from '../../../map-bridge/hooks/useNodesLayer';
import type { UseMapIntegrationOptions } from '../types';

/**
 * Hook responsible for orchestrating the Leaflet bridge, route layers, waypoint markers, and road network nodes
 */
export function useMapIntegration(options: Readonly<UseMapIntegrationOptions>) {
  const {
    containerRef,
    routes,
    activeRouteIndex,
    waypoints,
    graph,
    showNodes = false,
    layerFilters,
    onMapClick,
    onCursorMove,
    onWaypointDrag,
    onSelectAlternative,
    onMapReady
  } = options;

  const { map, isMapReady } = useMapBridge({
    containerRef,
    onMapClick,
    onCursorMove
  });

  useEffect(() => {
    if (isMapReady && map && onMapReady) {
      onMapReady(map);
    }
  }, [isMapReady, map, onMapReady]);

  useRouteLayer({
    map,
    routes,
    activeRouteIndex,
    onSelectAlternative
  });

  useWaypointMarkers({
    map,
    waypoints,
    onWaypointDrag
  });

  useNodesLayer({
    map,
    graph: graph ?? null,
    showNodes,
    filters: layerFilters
  });

  return { map, isMapReady };
}
