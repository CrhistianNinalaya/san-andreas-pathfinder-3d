import { useEffect } from 'react';
import { useMapBridge } from '../../../map-bridge/useMapBridge';
import { useRouteLayer } from '../../../map-bridge/useRouteLayer';
import { useWaypointMarkers } from '../../../map-bridge/useWaypointMarkers';
import { useNodesLayer } from '../../../map-bridge/useNodesLayer';
import type { UseMapIntegrationOptions } from '../types';

/**
 * Hook responsible for orchestrating the Leaflet bridge, route layers, waypoint markers, and debug node layer
 */
export function useMapIntegration(options: Readonly<UseMapIntegrationOptions>) {
  const {
    containerRef,
    routes,
    activeRouteIndex,
    waypoints,
    graph,
    showNodes = false,
    onMapClick,
    onCursorMove,
    onWaypointDrag,
    onSelectAlternative,
    onMapReady
  } = options;

  // Mount Leaflet instance
  const { map, isMapReady } = useMapBridge({
    containerRef,
    onMapClick,
    onCursorMove
  });

  // Notify parent when map instance is ready
  useEffect(() => {
    if (isMapReady && map && onMapReady) {
      onMapReady(map);
    }
  }, [isMapReady, map, onMapReady]);

  // Sync polyline routes layer
  useRouteLayer({
    map,
    routes,
    activeRouteIndex,
    onSelectAlternative
  });

  // Sync waypoint pins layer
  useWaypointMarkers({
    map,
    waypoints,
    onWaypointDrag
  });

  // Sync road network nodes layer
  useNodesLayer({
    map,
    graph: graph ?? null,
    showNodes
  });

  return { map, isMapReady };
}
