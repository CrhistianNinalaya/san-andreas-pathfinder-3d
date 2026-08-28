import { useEffect } from 'react';
import type { RouteState, RouteAction } from './routeReducer';
import type { GtaCoords } from '../../engine/types';
import { GTA_BOUNDS } from '../../geo/coordinates';
import { VEHICLE_PROFILES, type VehicleProfileType } from '../../terrain/ElevationPhysics';

function parseCoordinate(field: string | undefined): number | null {
  if (field === undefined) return null;
  const trimmed = field.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parses `?w=x,y;x,y` into world coordinates, discarding malformed or
 * out-of-bounds pairs instead of coercing them to (0, 0).
 */
function parseWaypointsParam(wParam: string): GtaCoords[] {
  const coords: GtaCoords[] = [];

  for (const part of wParam.split(';')) {
    const fields = part.split(',');
    if (fields.length !== 2) continue;

    const x = parseCoordinate(fields[0]);
    const y = parseCoordinate(fields[1]);
    if (x === null || y === null) continue;
    if (x < GTA_BOUNDS.minX || x > GTA_BOUNDS.maxX) continue;
    if (y < GTA_BOUNDS.minY || y > GTA_BOUNDS.maxY) continue;

    coords.push({ x, y });
  }

  return coords;
}

function parseVehicleParam(vParam: string | null): VehicleProfileType | undefined {
  if (vParam && vParam in VEHICLE_PROFILES) {
    return vParam as VehicleProfileType;
  }
  return undefined;
}

function parseRouteIndexParam(rParam: string | null): number | undefined {
  if (rParam === null) return undefined;
  const index = Number(rParam);
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}

export function useUrlState(state: RouteState, dispatch: React.Dispatch<RouteAction>) {
  // 1. Parse on initial graph load
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
