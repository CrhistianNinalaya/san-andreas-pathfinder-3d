import { useState, useEffect } from 'react';
import { PanelHeader } from '../PanelHeader';
import { PanelControls } from '../PanelControls';
import { SearchCombobox } from '../../features/search/SearchCombobox';
import { WaypointsList } from '../../features/waypoints/WaypointsList';
import { PanelActions } from '../PanelActions';
import { RouteCards } from '../../features/route/RouteCards';
import type { RouteState, RouteAction } from '../../features/route/routeReducer';
import styles from './NavigationPanel.module.css';

export interface NavigationPanelProps {
  state: RouteState;
  dispatch: React.Dispatch<RouteAction>;
  onScopeChange: (scope: RouteState['scope']) => void;
  onCenterMap: () => void;
}

export function NavigationPanel({
  state,
  dispatch,
  onScopeChange,
  onCenterMap
}: Readonly<NavigationPanelProps>) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-expand panel on mobile when user adds waypoints
  useEffect(() => {
    if (state.waypoints.length > 0) {
      setIsExpanded(true);
    }
  }, [state.waypoints.length]);

  function toggleExpand() {
    setIsExpanded((prev) => !prev);
  }

  return (
    <aside className={`${styles.floatingPanel} ${isExpanded ? styles.expanded : ''}`}>
      {/* Native button for accessible drawer toggling */}
      <button
        type="button"
        className={styles.headerTriggerButton}
        onClick={toggleExpand}
        aria-expanded={isExpanded}
        aria-controls="navigation-panel-body"
        aria-label={isExpanded ? 'Collapse navigation panel' : 'Expand navigation panel'}
      >
        {/* Mobile Drawer Pull Indicator */}
        <div className={styles.mobilePillWrapper}>
          <div className={styles.mobilePill} />
        </div>

        {/* Brand header with node count badge and toggle chevron */}
        <PanelHeader
          isLoading={state.isLoadingGraph}
          nodeCount={state.graphNodeCount}
          isExpanded={isExpanded}
        />
      </button>

      <div id="navigation-panel-body" className={styles.panelBody}>
        {/* Scope, language, vehicle, and nodes layer controls */}
        <PanelControls
          scope={state.scope}
          vehicleType={state.vehicleType}
          showNodes={state.showNodes}
          onScopeChange={onScopeChange}
          onVehicleChange={(vehicleType) => dispatch({ type: 'SET_VEHICLE', vehicleType })}
          onToggleNodes={() => dispatch({ type: 'TOGGLE_NODES' })}
        />

        {/* POI Landmark Search Combobox */}
        <SearchCombobox
          onSelectPlace={(coords) => dispatch({ type: 'ADD_WAYPOINT', coords })}
        />

        {/* Dynamic Waypoints List */}
        <WaypointsList
          waypoints={state.waypoints}
          onRemove={(index) => dispatch({ type: 'REMOVE_WAYPOINT', index })}
        />

        {/* Action Buttons: Reverse, Clear, Center */}
        <PanelActions
          waypointCount={state.waypoints.length}
          onReverse={() => dispatch({ type: 'REVERSE_WAYPOINTS' })}
          onClear={() => dispatch({ type: 'CLEAR_WAYPOINTS' })}
          onCenter={onCenterMap}
        />

        {/* Route Cards & 3D Elevation Breakdown */}
        <RouteCards
          routes={state.routes}
          activeRouteIndex={state.activeRouteIndex}
          onSelectRoute={(index) => dispatch({ type: 'SET_ACTIVE_ROUTE', index })}
          waypointCount={state.waypoints.length}
          vehicleType={state.vehicleType}
        />
      </div>
    </aside>
  );
}
