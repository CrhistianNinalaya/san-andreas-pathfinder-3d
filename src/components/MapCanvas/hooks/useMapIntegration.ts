import { useEffect } from 'react';
import { useMapBridge } from '../../../map-bridge/useMapBridge';
import { useRouteLayer } from '../../../map-bridge/useRouteLayer';
import { useWaypointMarkers } from '../../../map-bridge/useWaypointMarkers';
import type { UseMapIntegrationOptions } from '../types';

/**
 * Hook responsible for orchestrating the Leaflet bridge, route layers, and waypoint markers
 */
export function useMapIntegration(options: Readonly<UseMapIntegrationOptions>) {
  const {
    containerRef,
    routes,
    activeRouteIndex,
    waypoints,
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

  return { map, isMapReady };
}
