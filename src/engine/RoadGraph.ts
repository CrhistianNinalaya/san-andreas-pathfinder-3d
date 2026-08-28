/**
 * High-Performance RoadGraph & A* Pathfinding Engine
 */

import { MinHeap } from './MinHeap';
import {
  ElevationPhysics,
  VEHICLE_PROFILES,
  MAX_SLOPE_SPEED_MULTIPLIER,
  type VehicleProfileType
} from '../terrain/ElevationPhysics';

/**
 * Widens the heuristic's speed ceiling by a hair so floating-point rounding can
 * never push the estimate above a real edge cost that sits exactly at the peak.
 */
const HEURISTIC_SAFETY_MARGIN = 1.0001;
import type {
  GraphNode,
  AdjacencyEdge,
  RawDataset,
  CustomNetworkDataset,
  RouteResult,
  NearestNodeResult,
  GtaCoords,
  FindNearestOptions,
  FindPathOptions,
  FindAlternativesOptions
} from './types';

interface RelaxNeighborsOptions {
  currentId: string;
  neighbors: AdjacencyEdge[];
  goalNode: GraphNode;
  edgePenalties: Map<string, number>;
  vehicleType: VehicleProfileType;
  costSoFar: Map<string, number>;
  cameFrom: Map<string, string | null>;
  edgeUsed: Map<string, AdjacencyEdge>;
  frontier: MinHeap<string>;
}

export class RoadGraph {
  public nodes = new Map<string, GraphNode>();
  public adjacencyList = new Map<string, AdjacencyEdge[]>();
  public grid = new Map<string, GraphNode[]>();
  public cellSize = 200;
  public maxSpeedKmh = 110;
  public giantComponentRoot = 0;
  public totalGiantNodes = 0;

  constructor(data?: RawDataset, customData?: CustomNetworkDataset) {
    if (data) {
      this.init(data, customData);
    }
  }

  private _cellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  /**
   * Initializes the road graph from raw nodes and edges dataset, with optional custom network overlay
   */
  public init(data: RawDataset, customData?: CustomNetworkDataset): void {
    this.nodes.clear();
    this.adjacencyList.clear();
    this.grid.clear();

    const mergedNodes = customData?.nodes && customData.nodes.length > 0
      ? [...data.nodes, ...customData.nodes]
      : data.nodes;

    const mergedEdges = customData?.edges && customData.edges.length > 0
      ? [...data.edges, ...customData.edges]
      : data.edges;

    const nodeIndexMap = this._populateNodesAndGrid(mergedNodes);
    const parent = this._initUnionFind(mergedNodes.length);
    const maxEdgeSpeed = this._populateAdjacencyAndUnionFind(mergedEdges, nodeIndexMap, parent);
    const giantRoot = this._calculateGiantComponent(mergedNodes.length, parent);
    this._classifyNodesByComponent(mergedNodes, parent, giantRoot);

    this.maxSpeedKmh = Math.max(110, maxEdgeSpeed);
  }

  /**
   * Builds nodes Map and spatial hash grid
   */
  private _populateNodesAndGrid(rawNodes: RawDataset['nodes']): Map<string, number> {
    const nodeIndexMap = new Map<string, number>();

    for (let i = 0; i < rawNodes.length; i++) {
      const node = rawNodes[i];
      if (!node) continue;

      const idStr = String(node.id);
      nodeIndexMap.set(idStr, i);

      const nodeObj: GraphNode = {
        id: idStr,
        name: node.name || `Node ${node.id}`,
        x: node.x,
        y: node.y,
        z: node.z ?? 0,
        componentId: 0,
        isGiantComponent: false,
        isCustom: (node as GraphNode).isCustom,
        customType: (node as GraphNode).customType
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

    return nodeIndexMap;
  }

  /**
   * Initializes Union-Find parent array
   */
  private _initUnionFind(nodeCount: number): Int32Array {
    const parent = new Int32Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) {
      parent[i] = i;
    }
    return parent;
  }

  /**
   * Finds the root of a set in Union-Find with path compression
   */
  private _findRoot(parent: Int32Array, nodeIdx: number): number {
    let curr = nodeIdx;
    while (true) {
      const parentCurr = parent[curr];
      if (parentCurr === undefined || parentCurr === curr) {
        break;
      }
      const grandParent = parent[parentCurr];
      if (grandParent !== undefined) {
        parent[curr] = grandParent;
      }
      curr = parentCurr;
    }
    return curr;
  }

  /**
   * Builds adjacency lists and links connected components
   */
  private _populateAdjacencyAndUnionFind(
    edges: RawDataset['edges'],
    nodeIndexMap: Map<string, number>,
    parent: Int32Array
  ): number {
    let maxEdgeSpeed = 0;

    for (const edge of edges) {
      const fromId = String(edge.from);
      const toId = String(edge.to);

      const n1 = this.nodes.get(fromId);
      const n2 = this.nodes.get(toId);
      if (!n1 || !n2) continue;

      const idx1 = nodeIndexMap.get(fromId);
      const idx2 = nodeIndexMap.get(toId);
      if (idx1 !== undefined && idx2 !== undefined) {
        const root1 = this._findRoot(parent, idx1);
        const root2 = this._findRoot(parent, idx2);
        if (root1 !== root2) {
          parent[root1] = root2;
        }
      }

      const nominalSpeed = edge.speed ?? 80;
      if (nominalSpeed > maxEdgeSpeed) {
        maxEdgeSpeed = nominalSpeed;
      }

      const dist3D = ElevationPhysics.calculate3DDistance(n1, n2);
      const slope = ElevationPhysics.calculateSlope(n1, n2);

      const fromList = this.adjacencyList.get(fromId);
      if (fromList) {
        const customEdge = edge as import('./types').CustomEdge;
        const isCustom = customEdge.type !== undefined;
        fromList.push({
          to: toId,
          distance: dist3D,
          slope,
          slopePercent: Math.round(slope * 100),
          nominalSpeed,
          isCustom,
          type: customEdge.type
        });
      }
    }

    return maxEdgeSpeed;
  }

  /**
   * Calculates the giant connected component root and size
   */
  private _calculateGiantComponent(nodeCount: number, parent: Int32Array): number {
    const componentCounts = new Map<number, number>();
    for (let i = 0; i < nodeCount; i++) {
      const root = this._findRoot(parent, i);
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
    return giantRoot;
  }

  /**
   * Labels each graph node with its component id and giant flag
   */
  private _classifyNodesByComponent(
    rawNodes: RawDataset['nodes'],
    parent: Int32Array,
    giantRoot: number
  ): void {
    for (let i = 0; i < rawNodes.length; i++) {
      const node = rawNodes[i];
      if (!node) continue;
      const nodeObj = this.nodes.get(String(node.id));
      if (nodeObj) {
        const root = this._findRoot(parent, i);
        nodeObj.componentId = root;
        nodeObj.isGiantComponent = root === giantRoot;
      }
    }
  }

  public getEdgeTravelTime(edge: AdjacencyEdge, vehicleType: VehicleProfileType = 'car'): number {
    const slopeMultiplier = ElevationPhysics.getSlopeSpeedMultiplier(edge.slope, vehicleType);
    const effectiveSpeedKmH = Math.max(5, edge.nominalSpeed * slopeMultiplier);
    const effectiveSpeedMps = (effectiveSpeedKmH * 1000) / 3600;
    return edge.distance / effectiveSpeedMps;
  }

  /**
   * Scans a specific cell for the closest node
   */
  private _scanCellForNearest(
    cellNodes: GraphNode[],
    x: number,
    y: number,
    onlyGiant: boolean,
    best: { nearest: GraphNode | null; minDist: number }
  ): void {
    for (const node of cellNodes) {
      if (onlyGiant && !node.isGiantComponent) continue;
      const d = Math.hypot(node.x - x, node.y - y);
      if (d < best.minDist) {
        best.minDist = d;
        best.nearest = node;
      }
    }
  }

  /**
   * Finds the nearest road node to given world coordinates
   */
  public findNearestNode(options: FindNearestOptions): NearestNodeResult {
    const { x, y, onlyGiant = true } = options;
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    const best = { nearest: null as GraphNode | null, minDist: Infinity };
    let isProven = false;

    // 1. Check concentric radial rings in the spatial hash grid
    for (let r = 0; r <= 3; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const key = `${cx + dx},${cy + dy}`;
          const cellNodes = this.grid.get(key);
          if (cellNodes) {
            this._scanCellForNearest(cellNodes, x, y, onlyGiant, best);
          }
        }
      }
      // The query point sits anywhere inside its own cell, so scanning the
      // (2r+1)² block only guarantees coverage out to r * cellSize. Using
      // (r + 1) * cellSize here accepts hits that a neighbouring cell could beat.
      if (best.nearest && best.minDist <= r * this.cellSize) {
        isProven = true;
        break;
      }
    }

    // 2. Fallback exhaustive scan when the grid search found nothing, or ran out
    //    of rings before it could prove the candidate is the closest node.
    if (!isProven) {
      this._scanCellForNearest(Array.from(this.nodes.values()), x, y, onlyGiant, best);
    }

    return { node: best.nearest, distance: best.minDist };
  }

  /**
   * Admissible A* estimate: the fastest any edge could possibly be travelled is
   * the fastest road speed in the dataset, scaled by the vehicle's multiplier
   * and the peak downhill boost. Both factors come from ElevationPhysics rather
   * than being restated here, so the bound holds for any speed the data carries.
   */
  public heuristic(nodeA: GtaCoords, nodeB: GtaCoords, vehicleType: VehicleProfileType = 'car'): number {
    const dist = ElevationPhysics.calculate3DDistance(nodeA, nodeB);
    const profile = VEHICLE_PROFILES[vehicleType] ?? VEHICLE_PROFILES.car;
    const maxVehicleSpeedKmh =
      this.maxSpeedKmh * profile.nominalMultiplier * MAX_SLOPE_SPEED_MULTIPLIER * HEURISTIC_SAFETY_MARGIN;
    const maxSpeedMps = (maxVehicleSpeedKmh * 1000) / 3600;
    return dist / maxSpeedMps;
  }

  /**
   * Creates a zero distance route when origin equals destination
   */
  private _createZeroDistanceRoute(node: GraphNode, id: string): RouteResult {
    return {
      path: [node],
      nodeIds: [id],
      totalDistance: 0,
      totalTimeSeconds: 0,
      elevationProfile: {
        elevationGain: 0,
        elevationLoss: 0,
        minElevation: node.z,
        maxElevation: node.z
      },
      usedEdges: []
    };
  }

  /**
   * Evaluates and relaxes neighboring edges of the current node
   */
  private _relaxNeighbors(options: RelaxNeighborsOptions): void {
    const {
      currentId,
      neighbors,
      goalNode,
      edgePenalties,
      vehicleType,
      costSoFar,
      cameFrom,
      edgeUsed,
      frontier
    } = options;

    const currentCost = costSoFar.get(currentId) ?? 0;

    for (const edge of neighbors) {
      const nextId = edge.to;
      const nextNode = this.nodes.get(nextId);
      if (!nextNode) continue;

      const edgeKey = `${currentId}->${nextId}`;
      const penalty = edgePenalties.get(edgeKey) ?? 1.0;
      const edgeCost = this.getEdgeTravelTime(edge, vehicleType) * penalty;
      const newCost = currentCost + edgeCost;

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

  /**
   * A* shortest path search over the 3D road graph
   */
  public findShortestPath(options: FindPathOptions): RouteResult | null {
    const { startId, goalId, edgePenalties = new Map(), vehicleType = 'car' } = options;
    const sId = String(startId);
    const gId = String(goalId);

    const startNode = this.nodes.get(sId);
    const goalNode = this.nodes.get(gId);
    if (!startNode || !goalNode) return null;
    if (sId === gId) return this._createZeroDistanceRoute(startNode, sId);

    const frontier = new MinHeap<string>();
    frontier.push(sId, 0, 0);

    const cameFrom = new Map<string, string | null>([[sId, null]]);
    const costSoFar = new Map<string, number>([[sId, 0]]);
    const edgeUsed = new Map<string, AdjacencyEdge>();

    while (!frontier.isEmpty()) {
      const popped = frontier.pop();
      if (!popped) break;

      const { node: currentId, cost: currentCost } = popped;
      if (currentId === gId) break;

      // Stale-pop guard (P1-6)
      const bestCost = costSoFar.get(currentId);
      if (bestCost !== undefined && currentCost > bestCost) continue;

      const neighbors = this.adjacencyList.get(currentId) ?? [];
      this._relaxNeighbors({
        currentId,
        neighbors,
        goalNode,
        edgePenalties,
        vehicleType,
        costSoFar,
        cameFrom,
        edgeUsed,
        frontier
      });
    }

    if (!cameFrom.has(gId)) return null;

    return this._reconstructPath(gId, cameFrom, edgeUsed, vehicleType);
  }

  /**
   * Reconstructs the path from goal back to start using cameFrom pointers
   */
  private _reconstructPath(
    goalId: string,
    cameFrom: Map<string, string | null>,
    edgeUsed: Map<string, AdjacencyEdge>,
    vehicleType: VehicleProfileType
  ): RouteResult {
    const path: GraphNode[] = [];
    const nodeIds: string[] = [];
    const usedEdges: AdjacencyEdge[] = [];
    let curr: string | null = goalId;
    let totalDistance = 0;
    let totalTimeSeconds = 0;

    while (curr !== null) {
      nodeIds.unshift(curr);
      const currNode = this.nodes.get(curr);
      if (currNode) {
        path.unshift(currNode);
      }
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

  /**
   * Calculates the percentage of edge overlap between a candidate route and an existing route
   */
  private _calculateEdgeOverlap(candidateEdges: Set<string>, existingEdges: Set<string>): number {
    if (candidateEdges.size === 0) return 0;
    let shared = 0;
    for (const edge of candidateEdges) {
      if (existingEdges.has(edge)) {
        shared++;
      }
    }
    return shared / candidateEdges.size;
  }

  /**
   * Extracts edge keys from an array of node ids
   */
  private _extractEdgeKeys(nodeIds: string[]): Set<string> {
    const keys = new Set<string>();
    for (let j = 0; j < nodeIds.length - 1; j++) {
      const from = nodeIds[j];
      const to = nodeIds[j + 1];
      if (from && to) {
        keys.add(`${from}->${to}`);
      }
    }
    return keys;
  }

  /**
   * Finds optimal route plus alternative secondary routes with penalty factors
   */
  public findRoutesWithAlternatives(options: FindAlternativesOptions): RouteResult[] {
    const { startId, goalId, maxRoutes = 3, vehicleType = 'car' } = options;
    const results: RouteResult[] = [];
    const edgePenalties = new Map<string, number>();
    const acceptedEdgeSets: Set<string>[] = [];

    // Attempt up to maxRoutes * 2 searches to discover distinct alternatives
    for (let i = 0; i < maxRoutes * 2 && results.length < maxRoutes; i++) {
      const result = this.findShortestPath({
        startId,
        goalId,
        edgePenalties,
        vehicleType
      });
      if (!result) break;

      const candidateEdgeKeys = this._extractEdgeKeys(result.nodeIds);

      // Check if candidate route is distinct from all accepted routes (<= 70% overlap)
      const isTooSimilar = acceptedEdgeSets.some(existingSet => {
        return this._calculateEdgeOverlap(candidateEdgeKeys, existingSet) > 0.70;
      });

      if (!isTooSimilar) {
        acceptedEdgeSets.push(candidateEdgeKeys);
        results.push({
          ...result,
          index: results.length + 1,
          isOptimal: results.length === 0,
          label: results.length === 0 ? 'Fastest Route' : `Alternative Route ${results.length}`
        });
      }

      // Penalize used edges for the next iteration to find alternative paths
      for (const edgeKey of candidateEdgeKeys) {
        const currentPenalty = edgePenalties.get(edgeKey) ?? 1.0;
        edgePenalties.set(edgeKey, currentPenalty * 3.5);
      }
    }

    return results;
  }
}
