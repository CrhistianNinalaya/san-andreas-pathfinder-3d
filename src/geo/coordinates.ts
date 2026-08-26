/**
 * GTA San Andreas Geographic & Coordinate Systems
 * 
 * GTA San Andreas World Space:
 * X: [-3000, 3000] (West to East)
 * Y: [-3000, 3000] (South to North)
 * 
 * Leaflet L.CRS.Simple Space:
 * lat = GTA Y
 * lng = GTA X
 */

import type { GtaCoords } from '../engine/types';

export const GTA_BOUNDS = {
  minX: -3000,
  maxX: 3000,
  minY: -3000,
  maxY: 3000,
  leafletBounds: [
    [-3000, -3000],
    [3000, 3000]
  ] as [[number, number], [number, number]]
};

export const GTA_CENTERS = {
  all: {
    center: [0, 0] as [number, number],
    zoom: -1
  },
  losSantos: {
    center: [-1500, 1800] as [number, number],
    zoom: 0
  },
  sanFierro: {
    center: [200, -2000] as [number, number],
    zoom: 0
  },
  lasVenturas: {
    center: [1800, 1500] as [number, number],
    zoom: 0
  },
  countryside: {
    center: [-1500, -1000] as [number, number],
    zoom: 0
  }
};

/**
 * Converts GTA (x, y) coordinates to Leaflet [lat, lng]
 */
export function gtaToLatLng(x: number, y: number): [number, number] {
  return [y, x];
}

/**
 * Converts Leaflet { lat, lng } or [lat, lng] to GTA GtaCoords
 */
export function latLngToGta(latlng: { lat: number; lng: number } | [number, number]): GtaCoords {
  if (Array.isArray(latlng)) {
    return {
      x: Math.round(latlng[1]),
      y: Math.round(latlng[0])
    };
  }
  return {
    x: Math.round(latlng.lng),
    y: Math.round(latlng.lat)
  };
}

/**
 * Formats 3D distance in km or m
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Formats time in minutes and seconds
 */
export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  if (mins > 0) {
    return `${mins} min ${secs} s`;
  }
  return `${secs} s`;
}
