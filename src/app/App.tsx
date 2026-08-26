import React, { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { RoadGraph } from '../engine/RoadGraph';
import { useMapBridge } from '../map-bridge/useMapBridge';
import { useRouteLayer } from '../map-bridge/useRouteLayer';
import { useWaypointMarkers } from '../map-bridge/useWaypointMarkers';
import { routeReducer, initialRouteState } from '../features/route/routeReducer';
import { useUrlState } from '../features/route/useUrlState';
import { useTranslation } from '../i18n/useTranslation';
import { SearchCombobox } from '../features/search/SearchCombobox';
import { WaypointsList } from '../features/waypoints/WaypointsList';
import { RouteCards } from '../features/route/RouteCards';
import { GTA_CENTERS } from '../geo/coordinates';
import type { GtaCoords, RawDataset } from '../engine/types';
import type { VehicleProfileType } from '../terrain/ElevationPhysics';
import styles from './App.module.css';

export function App() {
  const { t, lang, setLang } = useTranslation();
  const [state, dispatch] = useReducer(routeReducer, initialRouteState);
  const [cursorCoords, setCursorCoords] = useState<GtaCoords>({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Sync route state with shareable URLs (?w=...&r=...&v=...)
  useUrlState(state, dispatch);

  // Load official dataset on mount
  useEffect(() => {
    fetch('data/san_andreas_official_nodes.json')
      .then(res => res.json())
      .then((data: RawDataset) => {
        const graph = new RoadGraph(data);
        dispatch({ type: 'SET_GRAPH', graph });
      })
      .catch(err => {
        console.error('Failed to load road graph:', err);
        dispatch({ type: 'SET_LOADING', isLoading: false });
      });
  }, []);

  // Map callbacks
  const handleMapClick = useCallback((coords: GtaCoords) => {
    if (coords.x < -3000 || coords.x > 3000 || coords.y < -3000 || coords.y > 3000) return;
    dispatch({ type: 'ADD_WAYPOINT', coords });
  }, []);

  const handleCursorMove = useCallback((coords: GtaCoords) => {
    setCursorCoords(coords);
  }, []);

  const handleWaypointDrag = useCallback((index: number, newCoords: GtaCoords) => {
    dispatch({ type: 'UPDATE_WAYPOINT', index, coords: newCoords });
  }, []);

  const handleSelectAlternative = useCallback((index: number) => {
    dispatch({ type: 'SET_ACTIVE_ROUTE', index });
  }, []);

  // Mount Leaflet
  const { map } = useMapBridge({
    containerRef: mapContainerRef,
    onMapClick: handleMapClick,
    onCursorMove: handleCursorMove
  });

  // Sync Layers
  useRouteLayer({
    map,
    routes: state.routes,
    activeRouteIndex: state.activeRouteIndex,
    onSelectAlternative: handleSelectAlternative
  });

  useWaypointMarkers({
    map,
    waypoints: state.waypoints,
    onWaypointDrag: handleWaypointDrag
  });

  // Focus / Scope handler
  const handleScopeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const scope = e.target.value as keyof typeof GTA_CENTERS;
    dispatch({ type: 'SET_SCOPE', scope });
    if (map && GTA_CENTERS[scope]) {
      map.setView(GTA_CENTERS[scope].center, GTA_CENTERS[scope].zoom);
    }
  };

  const handleVehicleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as VehicleProfileType;
    dispatch({ type: 'SET_VEHICLE', vehicleType: v });
  };

  const handleCenterAll = () => {
    if (map) {
      map.setView(GTA_CENTERS.all.center, GTA_CENTERS.all.zoom);
    }
  };

  return (
    <div className={styles.appContainer}>
      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className={styles.mapCanvas} />

      {/* Floating GPS Glassmorphism Navigation Panel */}
      <aside className={styles.floatingPanel}>
        <div className={styles.panelHeader}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>🧭</span>
            <div>
              <h1>{t('appTitle')}</h1>
            </div>
          </div>
          <span className={styles.badge}>
            {state.isLoadingGraph
              ? t('loading')
              : t('nodesLoaded', { count: state.graphNodeCount.toLocaleString() })}
          </span>
        </div>

        <div className={styles.panelBody}>
          {/* Controls: Area & Language */}
          <div className={styles.controlsRow}>
            <div style={{ flex: 1 }}>
              <select
                value={state.scope}
                onChange={handleScopeChange}
                className={styles.selectInput}
                title={t('networkScope')}
              >
                <option value="all">{t('scopeAll')}</option>
                <option value="losSantos">{t('scopeLS')}</option>
                <option value="sanFierro">{t('scopeSF')}</option>
                <option value="lasVenturas">{t('scopeLV')}</option>
                <option value="countryside">{t('scopeCountry')}</option>
              </select>
            </div>

            <div style={{ width: '85px' }}>
              <select
                value={lang}
                onChange={e => setLang(e.target.value as any)}
                className={styles.selectInput}
              >
                <option value="es">🇪🇸 ES</option>
                <option value="en">🇺🇸 EN</option>
              </select>
            </div>
          </div>

          {/* Vehicle Profile Selector */}
          <div>
            <select
              value={state.vehicleType}
              onChange={handleVehicleChange}
              className={styles.selectInput}
              title={t('vehicleProfile')}
            >
              <option value="car">{t('vehCar')}</option>
              <option value="sports">{t('vehSports')}</option>
              <option value="bike">{t('vehBike')}</option>
              <option value="truck">{t('vehTruck')}</option>
              <option value="offroad">{t('vehOffroad')}</option>
            </select>
          </div>

          {/* Search POI Landmark Combobox */}
          <SearchCombobox
            onSelectPlace={(coords) => {
              dispatch({ type: 'ADD_WAYPOINT', coords });
            }}
          />

          {/* Dynamic Waypoints List */}
          <WaypointsList
            waypoints={state.waypoints}
            onRemove={(index) => dispatch({ type: 'REMOVE_WAYPOINT', index })}
          />

          {/* Action Buttons: Reverse, Clear, Center */}
          <div className={styles.btnGroup}>
            <button
              onClick={() => dispatch({ type: 'REVERSE_WAYPOINTS' })}
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={state.waypoints.length < 2}
              title={t('reverse')}
            >
              🔄 {t('reverse')}
            </button>
            <button
              onClick={() => dispatch({ type: 'CLEAR_WAYPOINTS' })}
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={state.waypoints.length === 0}
              title={t('clear')}
            >
              🗑️ {t('clear')}
            </button>
            <button
              onClick={handleCenterAll}
              className={`${styles.btn} ${styles.btnPrimary}`}
              title={t('center')}
            >
              🗺️ {t('center')}
            </button>
          </div>

          {/* Route Cards and 3D Elevation Breakdown */}
          <RouteCards
            routes={state.routes}
            activeRouteIndex={state.activeRouteIndex}
            onSelectRoute={handleSelectAlternative}
            waypointCount={state.waypoints.length}
            vehicleType={state.vehicleType}
          />
        </div>
      </aside>

      {/* Live Coordinate Tracker */}
      <div className={styles.coordDisplay}>
        📍 X: {cursorCoords.x} | Y: {cursorCoords.y}
      </div>
    </div>
  );
}
