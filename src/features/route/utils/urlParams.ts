import type { GtaCoords } from '../../../engine/types';
import { GTA_BOUNDS } from '../../../geo/coordinates';
import { VEHICLE_PROFILES, type VehicleProfileType } from '../../../terrain/ElevationPhysics';
import type { Waypoint } from '../../../map-bridge/hooks/useWaypointMarkers';

/**
 * Parses a string coordinate field safely into a finite number.
 */
export function parseCoordinate(field: string | undefined): number | null {
  if (field === undefined) {
    return null;
  }
  const trimmed = field.trim();
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parses a "w" query parameter formatted as "x,y;x,y" into sanitized GTA world coordinates.
 */
export function parseWaypointsParam(wParam: string): GtaCoords[] {
  const coords: GtaCoords[] = [];

  for (const part of wParam.split(';')) {
    const fields = part.split(',');
    if (fields.length !== 2) {
      continue;
    }

    const x = parseCoordinate(fields.at(0));
    const y = parseCoordinate(fields.at(1));
    if (x === null || y === null) {
      continue;
    }
    if (x < GTA_BOUNDS.minX || x > GTA_BOUNDS.maxX) {
      continue;
    }
    if (y < GTA_BOUNDS.minY || y > GTA_BOUNDS.maxY) {
      continue;
    }

    coords.push({ x, y });
  }

  return coords;
}

/**
 * Parses a "v" vehicle query parameter into a validated vehicle profile type.
 */
export function parseVehicleParam(vParam: string | null): VehicleProfileType | undefined {
  if (vParam && Object.hasOwn(VEHICLE_PROFILES, vParam)) {
    return vParam as VehicleProfileType;
  }
  return undefined;
}

/**
 * Parses an "r" alternative route index parameter into a non-negative integer.
 */
export function parseRouteIndexParam(rParam: string | null): number | undefined {
  if (rParam === null || rParam.trim() === '') {
    return undefined;
  }
  const index = Number(rParam);
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}

/**
 * Serializes an array of waypoints into a compact "x,y;x,y" URL coordinate string.
 */
export function formatWaypointsParam(waypoints: Waypoint[]): string {
  return waypoints.map((wp) => `${Math.round(wp.coords.x)},${Math.round(wp.coords.y)}`).join(';');
}
