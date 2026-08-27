import { describe, it, expect } from 'vitest';
import { RoadGraph } from '../RoadGraph';
import type { RawDataset } from '../types';

describe('RoadGraph and A* Pathfinding', () => {
  const mockDataset: RawDataset = {
    nodes: [
      { id: 1, x: 0, y: 0, z: 0 },
      { id: 2, x: 1000, y: 0, z: 0 },
      { id: 3, x: 2000, y: 0, z: 0 },
      { id: 4, x: 1000, y: 1000, z: 0 },
      // 2km mountain climb route (10% grade)
      { id: 5, x: 0, y: 0, z: 0 },
      { id: 6, x: 2000, y: 0, z: 200 },
      // Isolated component (disconnected)
      { id: 99, x: 10000, y: 10000, z: 0 }
    ],
    edges: [
      { from: 1, to: 2, speed: 80 },
      { from: 2, to: 1, speed: 80 },
      { from: 2, to: 3, speed: 80 },
      { from: 3, to: 2, speed: 80 },
      { from: 1, to: 4, speed: 60 },
      { from: 4, to: 1, speed: 60 },
      { from: 4, to: 3, speed: 60 },
      { from: 3, to: 4, speed: 60 },
      { from: 5, to: 6, speed: 80 },
      { from: 6, to: 5, speed: 80 }
    ]
  };

  it('should identify the giant component and exclude isolated nodes during snap', () => {
    const graph = new RoadGraph(mockDataset);

    const node1 = graph.nodes.get('1');
    const node99 = graph.nodes.get('99');
    expect(node1?.isGiantComponent).toBe(true);
    expect(node99?.isGiantComponent).toBe(false);

    const nearest = graph.findNearestNode({ x: 9900, y: 9900, onlyGiant: true });
    expect(nearest.node?.id).not.toBe('99');
    expect(nearest.node?.isGiantComponent).toBe(true);
  });

  it('should find the shortest path between two connected nodes', () => {
    const graph = new RoadGraph(mockDataset);
    const result = graph.findShortestPath({ startId: '1', goalId: '3' });

    expect(result).not.toBeNull();
    expect(result?.nodeIds).toEqual(['1', '2', '3']);
    expect(result?.totalDistance).toBe(2000);
  });

  it('should generate alternative routes when available', () => {
    const graph = new RoadGraph(mockDataset);
    const routes = graph.findRoutesWithAlternatives({ startId: '1', goalId: '3', maxRoutes: 2 });

    expect(routes.length).toBe(2);
    expect(routes[0]?.isOptimal).toBe(true);
    expect(routes[0]?.nodeIds).toEqual(['1', '2', '3']);
    expect(routes[1]?.nodeIds).toEqual(['1', '4', '3']);
  });

  it('should compute different travel times based on vehicle profile', () => {
    const graph = new RoadGraph(mockDataset);

    const sportsRoute = graph.findShortestPath({ startId: '5', goalId: '6', vehicleType: 'sports' });
    const carRoute = graph.findShortestPath({ startId: '5', goalId: '6', vehicleType: 'car' });
    const truckRoute = graph.findShortestPath({ startId: '5', goalId: '6', vehicleType: 'truck' });

    expect(sportsRoute).not.toBeNull();
    expect(carRoute).not.toBeNull();
    expect(truckRoute).not.toBeNull();

    // Sports car is faster than standard car on climb
    expect(sportsRoute?.totalTimeSeconds).toBeDefined();
    expect(carRoute?.totalTimeSeconds).toBeDefined();
    expect(truckRoute?.totalTimeSeconds).toBeDefined();
    if (sportsRoute && carRoute && truckRoute) {
      expect(sportsRoute.totalTimeSeconds).toBeLessThan(carRoute.totalTimeSeconds);
      expect(truckRoute.totalTimeSeconds).toBeGreaterThan(carRoute.totalTimeSeconds);
    }
  });

  it('should guarantee admissibility of the heuristic', () => {
    const graph = new RoadGraph(mockDataset);
    const node1 = graph.nodes.get('1');
    const node3 = graph.nodes.get('3');
    expect(node1).toBeDefined();
    expect(node3).toBeDefined();

    if (node1 && node3) {
      const h = graph.heuristic(node1, node3, 'car');
      const result = graph.findShortestPath({ startId: '1', goalId: '3', vehicleType: 'car' });
      expect(result).toBeDefined();
      if (result) {
        expect(h).toBeLessThanOrEqual(result.totalTimeSeconds);
      }
    }
  });

  it('should filter out alternative candidates with >70% edge overlap', () => {
    const graph = new RoadGraph(mockDataset);
    const routes = graph.findRoutesWithAlternatives({ startId: '1', goalId: '3', maxRoutes: 3 });

    // In mockDataset, only 2 distinct routes exist (1->2->3 and 1->4->3)
    expect(routes.length).toBe(2);
  });
});
