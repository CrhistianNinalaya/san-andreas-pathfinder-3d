import { describe, it, expect } from 'vitest';
import { partitionLegSegments } from '../routeOverlap';
import type { RouteLeg } from '../../../engine/types';

describe('partitionLegSegments', () => {
  const node1 = { id: '1', name: 'N1', x: 0, y: 0, z: 0, componentId: 0, isGiantComponent: true };
  const node2 = { id: '2', name: 'N2', x: 100, y: 0, z: 0, componentId: 0, isGiantComponent: true };
  const node3 = { id: '3', name: 'N3', x: 200, y: 0, z: 0, componentId: 0, isGiantComponent: true };
  const node4 = { id: '4', name: 'N4', x: 300, y: 0, z: 0, componentId: 0, isGiantComponent: true };
  const node5 = { id: '5', name: 'N5', x: 200, y: 100, z: 0, componentId: 0, isGiantComponent: true };

  it('should mark all segments as non-overlapping when paths are disjoint', () => {
    const legs: RouteLeg[] = [
      { fromIndex: 0, toIndex: 1, fromLabel: 'A', toLabel: 'B', path: [node1, node2], totalDistance: 100, totalTimeSeconds: 10 },
      { fromIndex: 1, toIndex: 2, fromLabel: 'B', toLabel: 'C', path: [node2, node3], totalDistance: 100, totalTimeSeconds: 10 }
    ];

    const segments = partitionLegSegments(legs);
    expect(segments.length).toBe(2);
    expect(segments[0]?.isOverlapping).toBe(false);
    expect(segments[1]?.isOverlapping).toBe(false);
  });

  it('should detect shared edges and partition the second leg into overlapping and solo spans', () => {
    // Leg 1: 1 -> 2 -> 3 -> 4
    // Leg 2: 4 -> 3 -> 5 (re-traverses 4<->3, then diverges to 5)
    const legs: RouteLeg[] = [
      { fromIndex: 0, toIndex: 1, fromLabel: 'A', toLabel: 'B', path: [node1, node2, node3, node4], totalDistance: 300, totalTimeSeconds: 30 },
      { fromIndex: 1, toIndex: 2, fromLabel: 'B', toLabel: 'C', path: [node4, node3, node5], totalDistance: 200, totalTimeSeconds: 20 }
    ];

    const segments = partitionLegSegments(legs);
    // Leg 1: 1-2-3-4 (solo, isOverlapping=false)
    // Leg 2: 4-3 (overlapping, isOverlapping=true)
    // Leg 2: 3-5 (solo, isOverlapping=false)
    expect(segments.length).toBe(3);

    expect(segments[0]?.legIndex).toBe(0);
    expect(segments[0]?.isOverlapping).toBe(false);

    expect(segments[1]?.legIndex).toBe(1);
    expect(segments[1]?.isOverlapping).toBe(true);

    expect(segments[2]?.legIndex).toBe(1);
    expect(segments[2]?.isOverlapping).toBe(false);
  });
});
