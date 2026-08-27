import { useReducer, useState, useCallback } from 'react';
import type L from 'leaflet';
import { routeReducer, initialRouteState, type RouteState } from '../features/route/routeReducer';
import { useUrlState } from '../features/route/useUrlState';
import { useRoadGraph } from './hooks/useRoadGraph';
import { MapCanvas } from '../components/MapCanvas';
import { NavigationPanel } from '../components/NavigationPanel';
import { CoordinateTracker } from '../components/CoordinateTracker';
import { GTA_CENTERS } from '../geo/coordinates';
import type { GtaCoords } from '../engine/types';
import styles from './App.module.css';

export function App() {
  const [state, dispatch] = useReducer(routeReducer, initialRouteState);
  const [cursorCoords, setCursorCoords] = useState<GtaCoords>({ x: 0, y: 0 });
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Sync route state with shareable URLs (?w=...&r=...&v=...)
  useUrlState(state, dispatch);

  // Load official road network dataset on mount
  useRoadGraph(dispatch);

  // Scope viewport focus handler
  const handleScopeChange = useCallback((scope: RouteState['scope']) => {
    dispatch({ type: 'SET_SCOPE', scope });
    if (mapInstance && GTA_CENTERS[scope]) {
      mapInstance.setView(GTA_CENTERS[scope].center, GTA_CENTERS[scope].zoom);
    }
  }, [mapInstance]);

  // Center whole map handler
  const handleCenterAll = useCallback(() => {
    if (mapInstance) {
      mapInstance.setView(GTA_CENTERS.all.center, GTA_CENTERS.all.zoom);
    }
  }, [mapInstance]);

  // Stable map interaction callbacks
  const handleMapClick = useCallback((coords: GtaCoords) => {
    dispatch({ type: 'ADD_WAYPOINT', coords });
  }, []);

  const handleWaypointDrag = useCallback((index: number, coords: GtaCoords) => {
    dispatch({ type: 'UPDATE_WAYPOINT', index, coords });
  }, []);

  const handleSelectAlternative = useCallback((index: number) => {
    dispatch({ type: 'SET_ACTIVE_ROUTE', index });
  }, []);

  return (
    <div className={styles.appContainer}>
      {/* Interactive Leaflet Map Canvas */}
      <MapCanvas
        routes={state.routes}
        activeRouteIndex={state.activeRouteIndex}
        waypoints={state.waypoints}
        graph={state.graph}
        showNodes={state.showNodes}
        onMapClick={handleMapClick}
        onCursorMove={setCursorCoords}
        onWaypointDrag={handleWaypointDrag}
        onSelectAlternative={handleSelectAlternative}
        onMapReady={setMapInstance}
      />

      {/* Floating GPS Navigation Sidebar */}
      <NavigationPanel
        state={state}
        dispatch={dispatch}
        onScopeChange={handleScopeChange}
        onCenterMap={handleCenterAll}
      />

      {/* Real-time HUD Coordinate Tracker */}
      <CoordinateTracker coords={cursorCoords} />
    </div>
  );
}
