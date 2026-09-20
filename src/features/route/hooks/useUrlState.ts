import { useEffect } from 'react';
import type { RouteState, RouteAction } from '../routeReducer';
import {
  parseWaypointsParam,
  parseVehicleParam,
  parseRouteIndexParam,
  formatWaypointsParam
} from '../utils/urlParams';

/**
 * Hook synchronizing route navigation state with shareable browser URL search parameters.
 */
export function useUrlState(state: RouteState, dispatch: React.Dispatch<RouteAction>) {
  useEffect(() => {
    if (!state.graph) return;

    const params = new URLSearchParams(window.location.search);
    const wParam = params.get('w');
    if (!wParam) return;

    const coordsList = parseWaypointsParam(wParam);
    if (coordsList.length === 0) return;

    dispatch({
      type: 'RESTORE_URL_WAYPOINTS',
      waypointsCoords: coordsList,
      vehicle: parseVehicleParam(params.get('v')),
      altIndex: parseRouteIndexParam(params.get('r'))
    });
  }, [state.graph]);

  useEffect(() => {
    if (!state.graph || state.isLoadingGraph) return;

    const params = new URLSearchParams(window.location.search);

    if (state.waypoints.length > 0) {
      params.set('w', formatWaypointsParam(state.waypoints));
    } else {
      params.delete('w');
    }

    if (state.activeRouteIndex > 0) {
      params.set('r', String(state.activeRouteIndex));
    } else {
      params.delete('r');
    }

    if (state.vehicleType !== 'car') {
      params.set('v', state.vehicleType);
    } else {
      params.delete('v');
    }

    const newQuery = params.toString();
    const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [state.waypoints, state.activeRouteIndex, state.vehicleType]);
}
