import { describe, it, expect } from 'vitest';
import {
  parseCoordinate,
  parseWaypointsParam,
  parseVehicleParam,
  parseRouteIndexParam,
  formatWaypointsParam
} from './urlParams';
import type { Waypoint } from '../../../map-bridge/hooks/useWaypointMarkers';

describe('urlParams utilities', () => {
  describe('parseCoordinate', () => {
    it('parses valid numeric strings', () => {
      expect(parseCoordinate('100.5')).toBe(100.5);
      expect(parseCoordinate('-2500')).toBe(-2500);
      expect(parseCoordinate('  42  ')).toBe(42);
    });

    it('returns null for undefined or empty input', () => {
      expect(parseCoordinate(undefined)).toBeNull();
      expect(parseCoordinate('')).toBeNull();
      expect(parseCoordinate('   ')).toBeNull();
      expect(parseCoordinate('not-a-number')).toBeNull();
    });
  });

  describe('parseWaypointsParam', () => {
    it('parses valid comma-and-semicolon separated coordinates', () => {
      const parsed = parseWaypointsParam('100,200;-500,-600;1200,800');
      expect(parsed).toEqual([
        { x: 100, y: 200 },
        { x: -500, y: -600 },
        { x: 1200, y: 800 }
      ]);
    });

    it('filters out pairs outside San Andreas boundaries or malformed fields', () => {
      const parsed = parseWaypointsParam('100,200;99999,0;invalid,-100;0,-4000;500,-500');
      expect(parsed).toEqual([
        { x: 100, y: 200 },
        { x: 500, y: -500 }
      ]);
    });
  });

  describe('parseVehicleParam', () => {
    it('validates supported vehicle profile types', () => {
      expect(parseVehicleParam('bike')).toBe('bike');
      expect(parseVehicleParam('sports')).toBe('sports');
      expect(parseVehicleParam('truck')).toBe('truck');
      expect(parseVehicleParam('offroad')).toBe('offroad');
    });

    it('returns undefined for unknown or null vehicle profiles', () => {
      expect(parseVehicleParam(null)).toBeUndefined();
      expect(parseVehicleParam('spaceship')).toBeUndefined();
      expect(parseVehicleParam('toString')).toBeUndefined();
      expect(parseVehicleParam('constructor')).toBeUndefined();
      expect(parseVehicleParam('valueOf')).toBeUndefined();
    });
  });

  describe('parseRouteIndexParam', () => {
    it('parses valid integer route indices', () => {
      expect(parseRouteIndexParam('0')).toBe(0);
      expect(parseRouteIndexParam('2')).toBe(2);
    });

    it('returns undefined for negative, decimal, or null indices', () => {
      expect(parseRouteIndexParam(null)).toBeUndefined();
      expect(parseRouteIndexParam('')).toBeUndefined();
      expect(parseRouteIndexParam('   ')).toBeUndefined();
      expect(parseRouteIndexParam('-1')).toBeUndefined();
      expect(parseRouteIndexParam('1.5')).toBeUndefined();
      expect(parseRouteIndexParam('invalid')).toBeUndefined();
    });
  });

  describe('formatWaypointsParam', () => {
    it('serializes waypoints into rounded coordinate pairs', () => {
      const mockWaypoints: Waypoint[] = [
        {
          id: 'wp-1',
          label: 'A',
          coords: { x: 100.4, y: -200.7 },
          snapNode: { id: '1', name: 'N1', x: 100, y: -200, z: 10, componentId: 1, isGiantComponent: true }
        },
        {
          id: 'wp-2',
          label: 'B',
          coords: { x: 350.2, y: 450.8 },
          snapNode: { id: '2', name: 'N2', x: 350, y: 451, z: 15, componentId: 1, isGiantComponent: true }
        }
      ];

      expect(formatWaypointsParam(mockWaypoints)).toBe('100,-201;350,451');
    });
  });
});
