import L from 'leaflet';
import { gtaToLatLng, latLngToGta } from '../../../geo/coordinates';
import type { GtaCoords, GraphNode } from '../../../engine/types';

/**
 * Represents a user-placed navigational waypoint snapped to a road network node.
 */
export interface Waypoint {
  id: string;
  label: string;
  coords: GtaCoords;
  snapNode: GraphNode;
}

export interface CreateWaypointMarkerOptions {
  wp: Waypoint;
  idx: number;
  total: number;
  onDragEnd: (coords: GtaCoords) => void;
}

export interface RenderWaypointMarkersOptions {
  group: L.LayerGroup;
  waypoints: Waypoint[];
  visible?: boolean;
  onWaypointDrag: (index: number, newCoords: GtaCoords) => void;
}

/**
 * Creates a draggable Leaflet marker for a navigational waypoint.
 */
export function createWaypointMarker(options: Readonly<CreateWaypointMarkerOptions>): L.Marker {
  const { wp, idx, total, onDragEnd } = options;

  let pinClass = 'pin-waypoint';
  if (idx === 0) {
    pinClass = 'pin-start';
  } else if (idx === total - 1 && total > 1) {
    pinClass = 'pin-end';
  }

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

  marker.on('click', (e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);
  });

  marker.on('dragend', (e: L.LeafletEvent) => {
    const markerTarget = e.target as L.Marker;
    const rawCoords = latLngToGta(markerTarget.getLatLng());
    const clampedCoords: GtaCoords = {
      x: Math.max(-3000, Math.min(3000, rawCoords.x)),
      y: Math.max(-3000, Math.min(3000, rawCoords.y))
    };
    onDragEnd(clampedCoords);
  });

  return marker;
}

/**
 * Renders all active waypoints to the target Leaflet layer group.
 */
export function renderWaypointMarkers(options: Readonly<RenderWaypointMarkersOptions>): void {
  const { group, waypoints, visible = true, onWaypointDrag } = options;
  if (!visible) return;

  const total = waypoints.length;
  waypoints.forEach((wp, idx) => {
    const marker = createWaypointMarker({
      wp,
      idx,
      total,
      onDragEnd: (coords) => onWaypointDrag(idx, coords)
    });
    marker.addTo(group);
  });
}
