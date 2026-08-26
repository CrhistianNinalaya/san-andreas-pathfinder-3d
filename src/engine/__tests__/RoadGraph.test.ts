import { describe, it, expect } from 'vitest';
import { RoadGraph } from '../RoadGraph';
import type { RawDataset } from '../types';

describe('RoadGraph and A* Pathfinding', () => {
  const mockDataset: RawDataset = {
    nodes: [
      { id: 1, x: 0, y: 0, z: 0 },
      { id: 2, x: 100, y: 0, z: 0 },
      { id: 3, x: 200, y: 0, z: 0 },
      { id: 4, x: 100, y: 100, z: 0 },
      // Isolated component (disconnected)
      { id: 99, x: 1000, y: 1000, z: 0 }
    ],
    edges: [
      { from: 1, to: 2, speed: 80 },
      { from: 2, to: 1, speed: 80 },
      { from: 2, to: 3, speed: 80 },
      { from: 3, to: 2, speed: 80 },
      { from: 1, to: 4, speed: 60 },
      { from: 4, to: 1, speed: 60 },
      { from: 4, to: 3, speed: 60 },
      { from: 3, to: 4, speed: 60 }
    ]
  };

  it('should identify the giant component and exclude isolated nodes during snap', () => {
    const graph = new RoadGraph(mockDataset);
    expect(graph.totalGiantNodes).toBe(4);

    const node1 = graph.nodes.get('1');
    const node99 = graph.nodes.get('99');
    expect(node1?.isGiantComponent).toBe(true);
    expect(node99?.isGiantComponent).toBe(false);

    // Snapping near node 99 with onlyGiant=true should find the nearest giant component node
    const nearest = graph.findNearestNode(990, 990, true);
    expect(nearest.node?.id).not.toBe('99');
    expect(nearest.node?.isGiantComponent).toBe(true);
  });

  it('should find the shortest path between two connected nodes', () => {
    const graph = new RoadGraph(mockDataset);
    const result = graph.findShortestPath('1', '3');

    expect(result).not.toBeNull();
    expect(result?.nodeIds).toEqual(['1', '2', '3']);
    expect(result?.totalDistance).toBe(200);
  });

  it('should generate alternative routes when available', () => {
    const graph = new RoadGraph(mockDataset);
    const routes = graph.findRoutesWithAlternatives('1', '3', 2);

    expect(routes.length).toBe(2);
    expect(routes[0]?.isOptimal).toBe(true);
    expect(routes[0]?.nodeIds).toEqual(['1', '2', '3']);
    expect(routes[1]?.nodeIds).toEqual(['1', '4', '3']);
  });

  it('should guarantee admissibility of the heuristic', () => {
    const graph = new RoadGraph(mockDataset);
    const node1 = graph.nodes.get('1')!;
    const node3 = graph.nodes.get('3')!;

    const h = graph.heuristic(node1, node3);
    const result = graph.findShortestPath('1', '3')!;

    // Estimated time (heuristic) must be <= actual travel time
    expect(h).toBeLessThanOrEqual(result.totalTimeSeconds);
  });
});
