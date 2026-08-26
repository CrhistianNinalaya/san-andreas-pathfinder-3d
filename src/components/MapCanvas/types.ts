import type L from 'leaflet';
import type { GtaCoords, RouteResult } from '../../engine/types';
import type { Waypoint } from '../../map-bridge/useWaypointMarkers';

export interface MapCanvasProps {
  routes: RouteResult[];
  activeRouteIndex: number;
  waypoints: Waypoint[];
  onMapClick: (coords: GtaCoords) => void;
  onCursorMove?: (coords: GtaCoords) => void;
  onWaypointDrag: (index: number, newCoords: GtaCoords) => void;
  onSelectAlternative?: (index: number) => void;
  onMapReady?: (map: L.Map) => void;
}

export interface UseMapIntegrationOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  routes: RouteResult[];
  activeRouteIndex: number;
  waypoints: Waypoint[];
  onMapClick: (coords: GtaCoords) => void;
  onCursorMove?: (coords: GtaCoords) => void;
  onWaypointDrag: (index: number, newCoords: GtaCoords) => void;
  onSelectAlternative?: (index: number) => void;
  onMapReady?: (map: L.Map) => void;
}
