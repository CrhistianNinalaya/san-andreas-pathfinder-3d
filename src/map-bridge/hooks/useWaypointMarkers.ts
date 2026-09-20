import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GtaCoords } from '../../engine/types';
import { type Waypoint, renderWaypointMarkers } from '../utils/waypoint-markers/waypointMarkerRenderer';

export type { Waypoint };

/**
 * Options for the waypoint markers management hook.
 */
export interface UseWaypointMarkersOptions {
  map: L.Map | null;
  waypoints: Waypoint[];
  visible?: boolean;
  onWaypointDrag: (index: number, newCoords: GtaCoords) => void;
}

/**
 * Renders and manages draggable waypoint pin markers on the Leaflet map instance.
 */
export function useWaypointMarkers(options: Readonly<UseWaypointMarkersOptions>) {
  const { map, waypoints, visible = true, onWaypointDrag } = options;
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onWaypointDragRef = useRef(onWaypointDrag);
  onWaypointDragRef.current = onWaypointDrag;

  useEffect(() => {
    if (!map) return;

    layerGroupRef.current ??= L.layerGroup().addTo(map);
    const group = layerGroupRef.current;
    group.clearLayers();

    renderWaypointMarkers({
      group,
      waypoints,
      visible,
      onWaypointDrag: (index, coords) => onWaypointDragRef.current(index, coords)
    });
  }, [map, waypoints, visible]);
}
