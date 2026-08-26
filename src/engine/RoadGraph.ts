/**
 * High-Performance RoadGraph & A* Pathfinding Engine
 */

import { MinHeap } from './MinHeap';
import { ElevationPhysics, VEHICLE_PROFILES, type VehicleProfileType } from '../terrain/ElevationPhysics';
import type {
  GraphNode,
  AdjacencyEdge,
  RawDataset,
  RouteResult,
  NearestNodeResult,
  GtaCoords,
  FindNearestOptions,
  FindPathOptions,
  FindAlternativesOptions
} from './types';

export class RoadGraph {
  public nodes = new Map<string, GraphNode>();
  public adjacencyList = new Map<string, AdjacencyEdge[]>();
  public grid = new Map<string, GraphNode[]>();
  public cellSize = 200;
  public maxSpeedKmh = 110;
  public giantComponentRoot = 0;
  public totalGiantNodes = 0;

  constructor(data?: RawDataset) {
    if (data) {
      this.init(data);
    }
  }

  private _cellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  public init(data: RawDataset): void {
    this.nodes.clear();
    this.adjacencyList.clear();
    this.grid.clear();

    let maxEdgeSpeed = 0;
    const nodeCount = data.nodes.length;
    const nodeIndexMap = new Map<string, number>();

    // 1. Build nodes and spatial hash
    for (let i = 0; i < nodeCount; i++) {
      const node = data.nodes[i]!;
      const idStr = String(node.id);
      nodeIndexMap.set(idStr, i);

      const nodeObj: GraphNode = {
        id: idStr,
        name: node.name || `Node ${node.id}`,
        x: node.x,
        y: node.y,
        z: node.z ?? 0,
        componentId: 0,
        isGiantComponent: false
      };

      this.nodes.set(nodeObj.id, nodeObj);
      this.adjacencyList.set(nodeObj.id, []);

      const ckey = this._cellKey(node.x, node.y);
      let cell = this.grid.get(ckey);
      if (!cell) {
        cell = [];
        this.grid.set(ckey, cell);
      }
      cell.push(nodeObj);
    }

    // 2. Precompute Connected Components (Union-Find)
    const parent = new Int32Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) parent[i] = i;

    const find = (a: number): number => {
      while (parent[a] !== a) {
        parent[a] = parent[parent[a]!]!;
        a = parent[a]!;
      }
      return a;
    };

    // 3. Build edges storing 3D distance and slope
    for (let i = 0; i < data.edges.length; i++) {
      const edge = data.edges[i]!;
      const fromId = String(edge.from);
      const toId = String(edge.to);

      const n1 = this.nodes.get(fromId);
      const n2 = this.nodes.get(toId);
      if (!n1 || !n2) continue;

      const idx1 = nodeIndexMap.get(fromId);
      const idx2 = nodeIndexMap.get(toId);
      if (idx1 !== undefined && idx2 !== undefined) {
        const root1 = find(idx1);
        const root2 = find(idx2);
        if (root1 !== root2) parent[root1] = root2;
      }

      const nominalSpeed = edge.speed ?? 80;
      if (nominalSpeed > maxEdgeSpeed) maxEdgeSpeed = nominalSpeed;

      const dist3D = ElevationPhysics.calculate3DDistance(n1, n2);
      const slope = ElevationPhysics.calculateSlope(n1, n2);

      this.adjacencyList.get(fromId)!.push({
        to: toId,
        distance: dist3D,
        slope,
        slopePercent: Math.round(slope * 100),
        nominalSpeed
      });
    }

    // 4. Determine Giant Component
    const componentCounts = new Map<number, number>();
    for (let i = 0; i < nodeCount; i++) {
      const root = find(i);
      componentCounts.set(root, (componentCounts.get(root) ?? 0) + 1);
    }

    let maxComponentSize = 0;
    let giantRoot = 0;
    for (const [root, count] of componentCounts.entries()) {
      if (count > maxComponentSize) {
        maxComponentSize = count;
        giantRoot = root;
      }
    }

    this.giantComponentRoot = giantRoot;
    this.totalGiantNodes = maxComponentSize;

    // Label nodes
    for (let i = 0; i < nodeCount; i++) {
      const node = data.nodes[i]!;
      const nodeObj = this.nodes.get(String(node.id));
      if (nodeObj) {
        const root = find(i);
        nodeObj.componentId = root;
        nodeObj.isGiantComponent = root === giantRoot;
      }
    }

    this.maxSpeedKmh = Math.max(110, maxEdgeSpeed);
  }

  public getEdgeTravelTime(edge: AdjacencyEdge, vehicleType: VehicleProfileType = 'car'): number {
    const slopeMultiplier = ElevationPhysics.getSlopeSpeedMultiplier(edge.slope, vehicleType);
    const effectiveSpeedKmH = Math.max(5, edge.nominalSpeed * slopeMultiplier);
    const effectiveSpeedMps = (effectiveSpeedKmH * 1000) / 3600;
    return edge.distance / effectiveSpeedMps;
  }

  public findNearestNode(options: FindNearestOptions): NearestNodeResult {
    const { x, y, onlyGiant = true } = options;
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    let nearest: GraphNode | null = null;
    let minDist = Infinity;

    for (let r = 0; r <= 3; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const key = `${cx + dx},${cy + dy}`;
          const cellNodes = this.grid.get(key);
          if (cellNodes) {
            for (let i = 0; i < cellNodes.length; i++) {
              const node = cellNodes[i]!;
              if (onlyGiant && !node.isGiantComponent) continue;
              const d = Math.hypot(node.x - x, node.y - y);
              if (d < minDist) {
                minDist = d;
                nearest = node;
              }
            }
          }
        }
      }
      if (nearest && minDist <= (r + 1) * this.cellSize) break;
    }

    if (!nearest) {
      for (const node of this.nodes.values()) {
        if (onlyGiant && !node.isGiantComponent) continue;
        const d = Math.hypot(node.x - x, node.y - y);
        if (d < minDist) {
          minDist = d;
          nearest = node;
        }
      }
    }

    return { node: nearest, distance: minDist };
  }

  public heuristic(nodeA: GtaCoords, nodeB: GtaCoords, vehicleType: VehicleProfileType = 'car'): number {
    const dist = ElevationPhysics.calculate3DDistance(nodeA, nodeB);
    const profile = VEHICLE_PROFILES[vehicleType] ?? VEHICLE_PROFILES.car;
    const maxVehicleSpeedKmh = this.maxSpeedKmh * profile.nominalMultiplier * 1.10 + 1;
    const maxSpeedMps = (maxVehicleSpeedKmh * 1000) / 3600;
    return dist / maxSpeedMps;
  }

  public findShortestPath(options: FindPathOptions): RouteResult | null {
    const { startId, goalId, edgePenalties = new Map(), vehicleType = 'car' } = options;
    const sId = String(startId);
    const gId = String(goalId);

    const startNode = this.nodes.get(sId);
    const goalNode = this.nodes.get(gId);
    if (!startNode || !goalNode) return null;

    if (sId === gId) {
      return {
        path: [startNode],
        nodeIds: [sId],
        totalDistance: 0,
        totalTimeSeconds: 0,
        elevationProfile: {
          elevationGain: 0,
          elevationLoss: 0,
          minElevation: startNode.z,
          maxElevation: startNode.z
        },
        usedEdges: []
      };
    }

    const frontier = new MinHeap<string>();
    frontier.push(sId, 0, 0);

    const cameFrom = new Map<string, string | null>();
    const costSoFar = new Map<string, number>();
    const edgeUsed = new Map<string, AdjacencyEdge>();

    cameFrom.set(sId, null);
    costSoFar.set(sId, 0);

    while (!frontier.isEmpty()) {
      const popped = frontier.pop();
      if (!popped) break;

      const currentId = popped.node;
      const currentCost = popped.cost;

      if (currentId === gId) break;
      // Stale-pop guard (P1-6)
      const bestCost = costSoFar.get(currentId);
      if (bestCost !== undefined && currentCost > bestCost) continue;

      const neighbors = this.adjacencyList.get(currentId) ?? [];

      for (let i = 0; i < neighbors.length; i++) {
        const edge = neighbors[i]!;
        const nextId = edge.to;
        const nextNode = this.nodes.get(nextId);
        if (!nextNode) continue;

        const edgeKey = `${currentId}->${nextId}`;
        const penalty = edgePenalties.get(edgeKey) ?? 1.0;
        const edgeTime = this.getEdgeTravelTime(edge, vehicleType);
        const edgeCost = edgeTime * penalty;
        const newCost = (costSoFar.get(currentId) ?? 0) + edgeCost;

        const existingCost = costSoFar.get(nextId);
        if (existingCost === undefined || newCost < existingCost) {
          costSoFar.set(nextId, newCost);
          const priority = newCost + this.heuristic(nextNode, goalNode, vehicleType);
          frontier.push(nextId, priority, newCost);
          cameFrom.set(nextId, currentId);
          edgeUsed.set(nextId, edge);
        }
      }
    }

    if (!cameFrom.has(gId)) return null;

    const path: GraphNode[] = [];
    const nodeIds: string[] = [];
    const usedEdges: AdjacencyEdge[] = [];
    let curr: string | null = gId;
    let totalDistance = 0;
    let totalTimeSeconds = 0;

    while (curr !== null) {
      nodeIds.unshift(curr);
      path.unshift(this.nodes.get(curr)!);
      const prev: string | null | undefined = cameFrom.get(curr);
      if (prev) {
        const edge = edgeUsed.get(curr);
        if (edge) {
          usedEdges.unshift(edge);
          totalDistance += edge.distance;
          totalTimeSeconds += this.getEdgeTravelTime(edge, vehicleType);
        }
        curr = prev;
      } else {
        curr = null;
      }
    }

    const elevationProfile = ElevationPhysics.calculateElevationProfile(path);

    return {
      path,
      nodeIds,
      totalDistance: Math.round(totalDistance),
      totalTimeSeconds: Math.round(totalTimeSeconds),
      elevationProfile,
      usedEdges
    };
  }

  public findRoutesWithAlternatives(options: FindAlternativesOptions): RouteResult[] {
    const { startId, goalId, maxRoutes = 3, vehicleType = 'car' } = options;
    const results: RouteResult[] = [];
    const edgePenalties = new Map<string, number>();

    for (let i = 0; i < maxRoutes; i++) {
      const result = this.findShortestPath({
        startId,
        goalId,
        edgePenalties,
        vehicleType
      });
      if (!result) break;

      const pathSignature = result.nodeIds.join('>');
      if (!results.some(r => r.nodeIds.join('>') === pathSignature)) {
        results.push({
          ...result,
          index: i + 1,
          isOptimal: i === 0,
          label: i === 0 ? 'Fastest Route' : `Alternative Route ${i}`
        });
      }

      for (let j = 0; j < result.nodeIds.length - 1; j++) {
        const u = result.nodeIds[j]!;
        const v = result.nodeIds[j + 1]!;
        const edgeKey = `${u}->${v}`;
        const currentPenalty = edgePenalties.get(edgeKey) ?? 1.0;
        edgePenalties.set(edgeKey, currentPenalty * 3.5);
      }
    }

    return results;
  }
}
