import { useReducer, useState, useCallback } from 'react';
import type L from 'leaflet';
import { routeReducer, initialRouteState, type RouteState, type LayerFilters } from '../features/route/routeReducer';
import { useUrlState } from '../features/route/useUrlState';
import { useRoadGraph } from './hooks/useRoadGraph';
import { MapCanvas } from '../components/MapCanvas';
import { NavigationPanel } from '../components/NavigationPanel';
import { CoordinateTracker } from '../components/CoordinateTracker';
import { MapLegend } from '../components/MapLegend';
import { GTA_CENTERS } from '../geo/coordinates';
import type { GtaCoords } from '../engine/types';
import styles from './App.module.css';

/**
 * Root application component coordinating the navigation panel, map canvas, and network legend.
 */
export function App() {
  const [state, dispatch] = useReducer(routeReducer, initialRouteState);
  const [cursorCoords, setCursorCoords] = useState<GtaCoords>({ x: 0, y: 0 });
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  useUrlState(state, dispatch);
  useRoadGraph(dispatch);

  const handleScopeChange = useCallback((scope: RouteState['scope']) => {
    dispatch({ type: 'SET_SCOPE', scope });
    if (mapInstance && GTA_CENTERS[scope]) {
      mapInstance.setView(GTA_CENTERS[scope].center, GTA_CENTERS[scope].zoom);
    }
  }, [mapInstance]);

  const handleCenterAll = useCallback(() => {
    if (mapInstance) {
      mapInstance.setView(GTA_CENTERS.all.center, GTA_CENTERS.all.zoom);
    }
  }, [mapInstance]);

  const handleMapClick = useCallback((coords: GtaCoords) => {
    dispatch({ type: 'ADD_WAYPOINT', coords });
  }, []);

  const handleWaypointDrag = useCallback((index: number, coords: GtaCoords) => {
    dispatch({ type: 'UPDATE_WAYPOINT', index, coords });
  }, []);

  const handleSelectAlternative = useCallback((index: number) => {
    dispatch({ type: 'SET_ACTIVE_ROUTE', index });
  }, []);

  const handleToggleFilter = useCallback((key: keyof LayerFilters) => {
    dispatch({ type: 'TOGGLE_LAYER_FILTER', key });
  }, []);

  return (
    <div className={styles.appContainer}>
      <MapCanvas
        routes={state.routes}
        activeRouteIndex={state.activeRouteIndex}
        waypoints={state.waypoints}
        graph={state.graph}
        showNodes={state.showNodes}
        layerFilters={state.layerFilters}
        onMapClick={handleMapClick}
        onCursorMove={setCursorCoords}
        onWaypointDrag={handleWaypointDrag}
        onSelectAlternative={handleSelectAlternative}
        onMapReady={setMapInstance}
      />

      <NavigationPanel
        state={state}
        dispatch={dispatch}
        onScopeChange={handleScopeChange}
        onCenterMap={handleCenterAll}
      />

      <MapLegend
        filters={state.layerFilters}
        onToggleFilter={handleToggleFilter}
        showNodes={state.showNodes}
      />

      <CoordinateTracker coords={cursorCoords} />
    </div>
  );
}
