import { describe, it, expect } from 'vitest';
import { getWaypointLabel } from './waypointUtils';

describe('waypointUtils', () => {
  describe('getWaypointLabel', () => {
    it('generates letters for single-digit index and fallback for overflow', () => {
      expect(getWaypointLabel(0)).toBe('A');
      expect(getWaypointLabel(1)).toBe('B');
      expect(getWaypointLabel(25)).toBe('Z');
      expect(getWaypointLabel(26)).toBe('P27');
    });
  });
});
