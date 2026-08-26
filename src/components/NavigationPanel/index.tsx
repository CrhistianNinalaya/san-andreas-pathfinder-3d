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
  return (
    <aside className={styles.floatingPanel}>
      {/* Brand header with node count badge */}
      <PanelHeader
        isLoading={state.isLoadingGraph}
        nodeCount={state.graphNodeCount}
      />

      <div className={styles.panelBody}>
        {/* Scope, language and vehicle controls */}
        <PanelControls
          scope={state.scope}
          vehicleType={state.vehicleType}
          onScopeChange={onScopeChange}
          onVehicleChange={(vehicleType) => dispatch({ type: 'SET_VEHICLE', vehicleType })}
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
