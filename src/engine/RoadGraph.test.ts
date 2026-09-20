import { describe, it, expect } from 'vitest';
import { RoadGraph } from './RoadGraph';
import type { RawDataset, CustomEdge, CustomNetworkDataset } from './types';

describe('RoadGraph and A* Pathfinding', () => {
  const mockDataset: RawDataset = {
    nodes: [
      { id: 1, x: 0, y: 0, z: 0 },
      { id: 2, x: 1000, y: 0, z: 0 },
      { id: 3, x: 2000, y: 0, z: 0 },
      { id: 4, x: 1000, y: 1000, z: 0 },
      { id: 5, x: 0, y: 0, z: 0 },
      { id: 6, x: 2000, y: 0, z: 200 },
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

    expect(routes).toHaveLength(2);
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

    expect(routes).toHaveLength(2);
  });

  it('should enforce oneWay constraints and reject reverse traversal (P1-1)', () => {
    const directedDataset: RawDataset = {
      nodes: [
        { id: 10, x: 0, y: 0, z: 0 },
        { id: 20, x: 100, y: 0, z: 0 }
      ],
      edges: [
        { from: 10, to: 20, speed: 70, oneWay: true } as CustomEdge,
        { from: 20, to: 10, speed: 70 }
      ]
    };

    const graph = new RoadGraph(directedDataset);
    const forwardRoute = graph.findShortestPath({ startId: '10', goalId: '20' });
    const reverseRoute = graph.findShortestPath({ startId: '20', goalId: '10' });

    expect(forwardRoute).not.toBeNull();
    expect(forwardRoute?.nodeIds).toEqual(['10', '20']);
    expect(reverseRoute).toBeNull();
  });

  it('should classify only strongly connected core as giant component on directed graphs (P1-2)', () => {
    const directedSccDataset: RawDataset = {
      nodes: [
        { id: 100, x: 0, y: 0, z: 0 },
        { id: 101, x: 100, y: 0, z: 0 },
        { id: 102, x: 50, y: 100, z: 0 },
        { id: 200, x: -200, y: 0, z: 0 },
        { id: 300, x: 300, y: 0, z: 0 }
      ],
      edges: [
        { from: 100, to: 101, speed: 80 },
        { from: 101, to: 100, speed: 80 },
        { from: 101, to: 102, speed: 80 },
        { from: 102, to: 101, speed: 80 },
        { from: 102, to: 100, speed: 80 },
        { from: 100, to: 102, speed: 80 },
        { from: 200, to: 100, speed: 80, oneWay: true } as CustomEdge,
        { from: 101, to: 300, speed: 80, oneWay: true } as CustomEdge
      ]
    };

    const graph = new RoadGraph(directedSccDataset);

    expect(graph.nodes.get('100')?.isGiantComponent).toBe(true);
    expect(graph.nodes.get('101')?.isGiantComponent).toBe(true);
    expect(graph.nodes.get('102')?.isGiantComponent).toBe(true);

    expect(graph.nodes.get('200')?.isGiantComponent).toBe(false);
    expect(graph.nodes.get('300')?.isGiantComponent).toBe(false);
  });

  it('should prefer official nodes over custom shortcut nodes on exact coordinate ties (P2-1)', () => {
    const official: RawDataset = {
      nodes: [{ id: 'off_1', x: 500, y: 500, z: 10 }],
      edges: []
    };
    const custom: CustomNetworkDataset = {
      nodes: [{ id: 'sc_1_1', x: 500, y: 500, z: 10, isCustom: true, customType: 'shortcut' }],
      edges: []
    };

    const graph = new RoadGraph(official, custom);
    const snap = graph.findNearestNode({ x: 500, y: 500, onlyGiant: false });

    expect(snap.node?.id).toBe('off_1');
    expect(snap.node?.isCustom).toBeFalsy();
  });

  it('should guard against duplicate node IDs across layers without overwriting (P2-2)', () => {
    const official: RawDataset = {
      nodes: [
        { id: 'shared_id', x: 100, y: 100, z: 10 },
        { id: 'target_id', x: 200, y: 100, z: 10 }
      ],
      edges: [
        { from: 'shared_id', to: 'target_id', speed: 80 },
        { from: 'target_id', to: 'shared_id', speed: 80 }
      ]
    };
    const custom: CustomNetworkDataset = {
      nodes: [
        { id: 'shared_id', x: 9999, y: 9999, z: 99, isCustom: true }
      ],
      edges: []
    };

    const graph = new RoadGraph(official, custom);
    const node = graph.nodes.get('shared_id');

    expect(node?.x).toBe(100);
    expect(node?.y).toBe(100);
    expect(graph.adjacencyList.get('shared_id')).toHaveLength(1);
    expect(graph.adjacencyList.get('shared_id')?.[0]?.to).toBe('target_id');
  });

  it('should correctly find nearest node using concentric ring scan and fallback for far points (P2-3)', () => {
    const graph = new RoadGraph(mockDataset);

    const near = graph.findNearestNode({ x: 10, y: 10, onlyGiant: true });
    expect(near.node?.id).toBe('1');
    expect(near.distance).toBeCloseTo(Math.hypot(10, 10));

    const far = graph.findNearestNode({ x: -2000, y: -2000, onlyGiant: true });
    expect(far.node?.id).toBe('1');
    expect(far.distance).toBeCloseTo(Math.hypot(2000, 2000));
  });
});
