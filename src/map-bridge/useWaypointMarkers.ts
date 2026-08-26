import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { gtaToLatLng, latLngToGta } from '../geo/coordinates';
import type { GtaCoords, GraphNode } from '../engine/types';

export interface Waypoint {
  id: string;
  label: string;
  coords: GtaCoords;
  snapNode: GraphNode;
}

export interface UseWaypointMarkersOptions {
  map: L.Map | null;
  waypoints: Waypoint[];
  onWaypointDrag: (index: number, newCoords: GtaCoords) => void;
}

export function useWaypointMarkers(options: Readonly<UseWaypointMarkersOptions>) {
  const { map, waypoints, onWaypointDrag } = options;
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    const group = layerGroupRef.current;
    group.clearLayers();

    const total = waypoints.length;
    waypoints.forEach((wp, idx) => {
      let pinClass = 'pin-waypoint';
      if (idx === 0) pinClass = 'pin-start';
      else if (idx === total - 1 && total > 1) pinClass = 'pin-end';

      const icon = L.divIcon({
        className: '',
        html: `<div class="custom-pin ${pinClass}"><span>${wp.label}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      });

      const marker = L.marker(gtaToLatLng(wp.coords.x, wp.coords.y), {
        draggable: true,
        icon
      });

      marker.on('dragend', (e: L.LeafletEvent) => {
        const markerTarget = e.target as L.Marker;
        const rawCoords = latLngToGta(markerTarget.getLatLng());
        const clampedCoords: GtaCoords = {
          x: Math.max(-3000, Math.min(3000, rawCoords.x)),
          y: Math.max(-3000, Math.min(3000, rawCoords.y))
        };
        onWaypointDrag(idx, clampedCoords);
      });

      marker.addTo(group);
    });
  }, [map, waypoints, onWaypointDrag]);
}
