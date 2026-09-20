import type L from 'leaflet';
import type { GtaCoords, RouteResult } from '../../engine/types';
import type { RoadGraph } from '../../engine/RoadGraph';
import type { Waypoint } from '../../map-bridge/hooks/useWaypointMarkers';

import type { LayerFilters } from '../../features/route/routeReducer';

/**
 * Props for the MapCanvas component.
 */
export interface MapCanvasProps {
  routes: RouteResult[];
  activeRouteIndex: number;
  waypoints: Waypoint[];
  graph?: RoadGraph | null;
  showNodes?: boolean;
  layerFilters?: LayerFilters;
  onMapClick: (coords: GtaCoords) => void;
  onCursorMove?: (coords: GtaCoords) => void;
  onWaypointDrag: (index: number, newCoords: GtaCoords) => void;
  onSelectAlternative?: (index: number) => void;
  onMapReady?: (map: L.Map) => void;
}

/**
 * Options for the useMapIntegration orchestrator hook.
 */
export interface UseMapIntegrationOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  routes: RouteResult[];
  activeRouteIndex: number;
  waypoints: Waypoint[];
  graph?: RoadGraph | null;
  showNodes?: boolean;
  layerFilters?: LayerFilters;
  onMapClick: (coords: GtaCoords) => void;
  onCursorMove?: (coords: GtaCoords) => void;
  onWaypointDrag: (index: number, newCoords: GtaCoords) => void;
  onSelectAlternative?: (index: number) => void;
  onMapReady?: (map: L.Map) => void;
}
