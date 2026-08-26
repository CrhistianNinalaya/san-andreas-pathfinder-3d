import { useEffect } from 'react';
import type { RouteState, RouteAction } from './routeReducer';
import type { GtaCoords } from '../../engine/types';
import type { VehicleProfileType } from '../../terrain/ElevationPhysics';

export function useUrlState(state: RouteState, dispatch: React.Dispatch<RouteAction>) {
  // 1. Parse on initial graph load
  useEffect(() => {
    if (!state.graph) return;

    const params = new URLSearchParams(window.location.search);
    const wParam = params.get('w');
    const vParam = params.get('v') as VehicleProfileType | null;
    const rParam = params.get('r');

    if (wParam) {
      const coordsList: GtaCoords[] = wParam.split(';').map(part => {
        const [x, y] = part.split(',').map(Number);
        return { x: x || 0, y: y || 0 };
      }).filter(c => !isNaN(c.x) && !isNaN(c.y));

      if (coordsList.length > 0) {
        dispatch({
          type: 'RESTORE_URL_WAYPOINTS',
          waypointsCoords: coordsList,
          vehicle: vParam || undefined,
          altIndex: rParam ? Number(rParam) : undefined
        });
      }
    }
  }, [state.graph]);

  // 2. Sync to URL on committed route changes
  useEffect(() => {
    if (!state.graph || state.isLoadingGraph) return;

    const params = new URLSearchParams(window.location.search);

    if (state.waypoints.length > 0) {
      const wStr = state.waypoints.map(wp => `${Math.round(wp.coords.x)},${Math.round(wp.coords.y)}`).join(';');
      params.set('w', wStr);
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
