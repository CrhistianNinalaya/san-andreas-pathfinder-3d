import { describe, it, expect } from 'vitest';
import { calculateChartPoints } from './calculatePoints';
import type { GraphNode } from '../../../engine/types';

describe('calculateChartPoints', () => {
  it('returns null if path has fewer than 2 nodes', () => {
    expect(calculateChartPoints([])).toBeNull();
    const singleNode: GraphNode = {
      id: '1',
      name: 'Single',
      x: 0,
      y: 0,
      z: 10,
      componentId: 0,
      isGiantComponent: true
    };
    expect(calculateChartPoints([singleNode])).toBeNull();
  });

  it('generates valid SVG line and area paths for a multi-node 3D route', () => {
    const nodes: GraphNode[] = [
      { id: '1', name: 'Start', x: 0, y: 0, z: 10, componentId: 0, isGiantComponent: true },
      { id: '2', name: 'Peak', x: 100, y: 0, z: 50, componentId: 0, isGiantComponent: true },
      { id: '3', name: 'End', x: 200, y: 0, z: 20, componentId: 0, isGiantComponent: true }
    ];

    const result = calculateChartPoints(nodes, 300, 70);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.minZ).toBe(10);
    expect(result.maxZ).toBe(50);
    expect(result.startZ).toBe(10);
    expect(result.endZ).toBe(20);
    expect(result.totalDistanceMeters).toBe(200);

    // Line path should start with 'M' and contain 'L'
    expect(result.linePath.startsWith('M 0')).toBe(true);
    expect(result.linePath).toContain('L 300');

    // Area path should close with 'Z'
    expect(result.areaPath.endsWith('Z')).toBe(true);
  });
});
