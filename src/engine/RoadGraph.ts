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

interface DfsState {
  u: number;
  idList: string[];
  nodeIndexMap: Map<string, number>;
  visited: Uint8Array;
  order: number[];
  orderIdx: number;
}

interface DfsNeighborOptions {
  top: { u: number; edgeIdx: number };
  neighbors: AdjacencyEdge[];
  nodeIndexMap: Map<string, number>;
  visited: Uint8Array;
}

interface ScanGridOptions {
  x: number;
  y: number;
  onlyGiant: boolean;
  best: { nearest: GraphNode | null; minDist: number };
}

interface RingScanOptions extends ScanGridOptions {
  cx: number;
  cy: number;
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

    const { nodeIndexMap, idList } = this._populateNodesAndGrid(mergedNodes);
    const maxEdgeSpeed = this._populateAdjacency(mergedEdges);
    this._calculateStronglyConnectedComponents(idList, nodeIndexMap);

    this.maxSpeedKmh = Math.max(110, maxEdgeSpeed);
  }

  /**
   * Builds nodes Map and spatial hash grid, guarding against cross-layer duplicate IDs
   */
  private _populateNodesAndGrid(rawNodes: RawDataset['nodes']): {
    nodeIndexMap: Map<string, number>;
    idList: string[];
  } {
    const nodeIndexMap = new Map<string, number>();
    const idList: string[] = [];

    for (const node of rawNodes) {
      if (!node) continue;

      const idStr = String(node.id);
      if (this.nodes.has(idStr)) {
        console.warn(`Duplicate node ID '${idStr}' detected across layers. Skipping duplicate entry.`);
        continue;
      }

      const assignedIndex = idList.length;
      nodeIndexMap.set(idStr, assignedIndex);
      idList.push(idStr);

      const nodeObj: GraphNode = {
        id: idStr,
        name: node.name || `Node ${node.id}`,
        x: node.x,
        y: node.y,
        z: node.z ?? 0,
        componentId: 0,
        isGiantComponent: false,
        isCustom: (node as GraphNode).isCustom,
        customType: (node as GraphNode).customType,
        color: (node as GraphNode).color
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

    return { nodeIndexMap, idList };
  }

  /**
   * Prunes any existing reverse edge from toId going to fromId (P1-1)
   */
  private _pruneReverseEdge(fromId: string, toId: string): void {
    const toList = this.adjacencyList.get(toId);
    if (!toList) return;

    const filtered = toList.filter((e) => e.to !== fromId);
    if (filtered.length !== toList.length) {
      console.warn(`Removed prior reverse edge ${toId}->${fromId} due to oneWay assertion on ${fromId}->${toId}`);
      this.adjacencyList.set(toId, filtered);
    }
  }

  /**
   * Builds adjacency lists and enforces oneWay edge constraints
   */
  private _populateAdjacency(edges: RawDataset['edges']): number {
    let maxEdgeSpeed = 0;
    const oneWayEdgeKeys = new Set<string>();

    for (const edge of edges) {
      const fromId = String(edge.from);
      const toId = String(edge.to);

      const n1 = this.nodes.get(fromId);
      const n2 = this.nodes.get(toId);
      if (!n1) continue;
      if (!n2) continue;

      const customEdge = edge as import('./types').CustomEdge;
      const isOneWay = customEdge.oneWay === true;

      // If this edge is the reverse of an existing oneWay edge, reject it (P1-1)
      const reverseKey = `${toId}->${fromId}`;
      if (oneWayEdgeKeys.has(reverseKey)) {
        console.warn(`Suppressed reverse edge ${fromId}->${toId} conflicting with oneWay edge ${reverseKey}`);
        continue;
      }

      if (isOneWay) {
        oneWayEdgeKeys.add(`${fromId}->${toId}`);
        this._pruneReverseEdge(fromId, toId);
      }

      const nominalSpeed = edge.speed ?? 80;
      if (nominalSpeed > maxEdgeSpeed) {
        maxEdgeSpeed = nominalSpeed;
      }

      const dist3D = ElevationPhysics.calculate3DDistance(n1, n2);
      const slope = ElevationPhysics.calculateSlope(n1, n2);

      const fromList = this.adjacencyList.get(fromId);
      if (!fromList) continue;

      fromList.push({
        to: toId,
        distance: dist3D,
        slope,
        slopePercent: Math.round(slope * 100),
        nominalSpeed,
        isCustom: customEdge.type !== undefined,
        type: customEdge.type,
        color: customEdge.color,
        description: customEdge.description,
        oneWay: isOneWay
      });
    }

    return maxEdgeSpeed;
  }

  /**
   * Explores the next unvisited neighbor during iterative DFS traversal
   */
  private _dfsExploreNextNeighbor(options: DfsNeighborOptions): number | null {
    const { top, neighbors, nodeIndexMap, visited } = options;
    const edge = neighbors[top.edgeIdx];
    top.edgeIdx++;
    if (!edge) return null;

    const v = nodeIndexMap.get(edge.to);
    if (v === undefined) return null;
    if (visited[v]) return null;

    visited[v] = 1;
    return v;
  }

  /**
   * Performs an iterative DFS from start node to record finishing order
   */
  private _dfsIterative(state: DfsState): number {
    const { u, idList, nodeIndexMap, visited, order } = state;
    let orderIdx = state.orderIdx;
    const dfsStack: { u: number; edgeIdx: number }[] = [{ u, edgeIdx: 0 }];
    visited[u] = 1;

    while (dfsStack.length > 0) {
      const top = dfsStack.at(-1);
      if (!top) break;

      const uId = idList[top.u];
      const neighbors = uId ? this.adjacencyList.get(uId) : undefined;

      if (neighbors && top.edgeIdx < neighbors.length) {
        const nextNode = this._dfsExploreNextNeighbor({ top, neighbors, nodeIndexMap, visited });
        if (nextNode !== null) {
          dfsStack.push({ u: nextNode, edgeIdx: 0 });
        }
      } else {
        dfsStack.pop();
        order[orderIdx++] = top.u;
      }
    }

    return orderIdx;
  }

  /**
   * Computes DFS finish order on the original graph
   */
  private _computeDfsFinishOrder(idList: string[], nodeIndexMap: Map<string, number>): number[] {
    const nodeCount = idList.length;
    const visited = new Uint8Array(nodeCount);
    const order: number[] = new Array(nodeCount);
    let orderIdx = 0;

    for (let i = 0; i < nodeCount; i++) {
      if (visited[i]) continue;
      orderIdx = this._dfsIterative({ u: i, idList, nodeIndexMap, visited, order, orderIdx });
    }

    return order;
  }

  /**
   * Builds the transposed (reversed edges) graph
   */
  private _buildTransposedGraph(idList: string[], nodeIndexMap: Map<string, number>): number[][] {
    const nodeCount = idList.length;
    const transpose: number[][] = Array.from({ length: nodeCount }, () => []);

    for (const [u, uId] of idList.entries()) {
      const neighbors = this.adjacencyList.get(uId);
      if (!neighbors) continue;
      for (const edge of neighbors) {
        const v = nodeIndexMap.get(edge.to);
        if (v !== undefined) {
          transpose[v]?.push(u);
        }
      }
    }

    return transpose;
  }

  /**
   * Traverses an SCC in the transposed graph
   */
  private _dfsTransposeVisit(
    root: number,
    options: { currentScc: number; transpose: number[][]; sccComponent: Int32Array }
  ): number {
    const { currentScc, transpose, sccComponent } = options;
    const stack: number[] = [root];
    sccComponent[root] = currentScc;
    let currentSize = 0;

    while (stack.length > 0) {
      const u = stack.pop();
      if (u === undefined) break;
      currentSize++;

      const revNeighbors = transpose[u];
      if (!revNeighbors) continue;

      for (const v of revNeighbors) {
        if (sccComponent[v] === -1) {
          sccComponent[v] = currentScc;
          stack.push(v);
        }
      }
    }

    return currentSize;
  }

  /**
   * Assigns SCC IDs by running DFS on the transposed graph in reverse finish order
   */
  private _assignSccComponents(order: number[], transpose: number[][]): {
    sccComponent: Int32Array;
    sccSizes: Map<number, number>;
  } {
    const nodeCount = order.length;
    const sccComponent = new Int32Array(nodeCount).fill(-1);
    const sccSizes = new Map<number, number>();
    let sccCount = 0;

    for (let i = nodeCount - 1; i >= 0; i--) {
      const root = order[i];
      if (root === undefined) continue;
      if (sccComponent[root] !== -1) continue;

      const currentScc = sccCount++;
      const size = this._dfsTransposeVisit(root, { currentScc, transpose, sccComponent });
      sccSizes.set(currentScc, size);
    }

    return { sccComponent, sccSizes };
  }

  /**
   * Finds the giant strongly connected component
   */
  private _findGiantScc(sccSizes: Map<number, number>): { giantSccId: number; maxSccSize: number } {
    let maxSccSize = 0;
    let giantSccId = 0;

    for (const [sccId, size] of sccSizes.entries()) {
      if (size > maxSccSize) {
        maxSccSize = size;
        giantSccId = sccId;
      }
    }

    return { giantSccId, maxSccSize };
  }

  /**
   * Classifies nodes with componentId and isGiantComponent
   */
  private _classifySccNodes(options: {
    idList: string[];
    sccComponent: Int32Array;
    giantSccId: number;
  }): void {
    const { idList, sccComponent, giantSccId } = options;

    for (const [i, idStr] of idList.entries()) {
      const nodeObj = this.nodes.get(idStr);
      if (nodeObj) {
        const comp = sccComponent[i] ?? -1;
        nodeObj.componentId = comp;
        nodeObj.isGiantComponent = comp === giantSccId;
      }
    }
  }

  /**
   * Calculates Strongly Connected Components (SCC) using Kosaraju's algorithm
   * to accurately classify the giant routable component on directed graphs (P1-2).
   */
  private _calculateStronglyConnectedComponents(
    idList: string[],
    nodeIndexMap: Map<string, number>
  ): void {
    if (idList.length === 0) {
      this.giantComponentRoot = 0;
      this.totalGiantNodes = 0;
      return;
    }

    const order = this._computeDfsFinishOrder(idList, nodeIndexMap);
    const transpose = this._buildTransposedGraph(idList, nodeIndexMap);
    const { sccComponent, sccSizes } = this._assignSccComponents(order, transpose);
    const { giantSccId, maxSccSize } = this._findGiantScc(sccSizes);

    this.giantComponentRoot = giantSccId;
    this.totalGiantNodes = maxSccSize;

    this._classifySccNodes({ idList, sccComponent, giantSccId });
  }

  public getEdgeTravelTime(edge: AdjacencyEdge, vehicleType: VehicleProfileType = 'car'): number {
    const slopeMultiplier = ElevationPhysics.getSlopeSpeedMultiplier(edge.slope, vehicleType);
    const effectiveSpeedKmH = Math.max(5, edge.nominalSpeed * slopeMultiplier);
    const effectiveSpeedMps = (effectiveSpeedKmH * 1000) / 3600;
    return edge.distance / effectiveSpeedMps;
  }

  /**
   * Scans an iterable of nodes for the closest node with official-priority tie-breaking (P2-1)
   */
  private _scanCellForNearest(
    cellNodes: Iterable<GraphNode>,
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
      } else if (d === best.minDist && best.nearest?.isCustom && !node.isCustom) {
        // Break exact ties in favor of official network nodes (P2-1)
        best.nearest = node;
      }
    }
  }

  /**
   * Scans a single grid cell if it contains nodes
   */
  private _scanGridCell(cellKey: string, options: ScanGridOptions): void {
    const cellNodes = this.grid.get(cellKey);
    if (cellNodes) {
      this._scanCellForNearest(cellNodes, options.x, options.y, options.onlyGiant, options.best);
    }
  }

  /**
   * Scans the perimeter cells of ring r around center (cx, cy)
   */
  private _scanRingPerimeter(r: number, options: RingScanOptions): void {
    const { cx, cy, x, y, onlyGiant, best } = options;
    const scanOpts: ScanGridOptions = { x, y, onlyGiant, best };

    if (r === 0) {
      this._scanGridCell(`${cx},${cy}`, scanOpts);
      return;
    }

    for (let dx = -r; dx <= r; dx++) {
      this._scanGridCell(`${cx + dx},${cy - r}`, scanOpts);
      this._scanGridCell(`${cx + dx},${cy + r}`, scanOpts);
    }

    for (let dy = -r + 1; dy <= r - 1; dy++) {
      this._scanGridCell(`${cx - r},${cy + dy}`, scanOpts);
      this._scanGridCell(`${cx + r},${cy + dy}`, scanOpts);
    }
  }

  /**
   * Finds the nearest road node to given world coordinates (P2-3)
   */
  public findNearestNode(options: FindNearestOptions): NearestNodeResult {
    const { x, y, onlyGiant = true } = options;
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    const best = { nearest: null as GraphNode | null, minDist: Infinity };
    const ringOpts: RingScanOptions = { cx, cy, x, y, onlyGiant, best };
    let isProven = false;

    // 1. Check concentric radial rings in the spatial hash grid (perimeter only, 49 cells total)
    for (let r = 0; r <= 3; r++) {
      this._scanRingPerimeter(r, ringOpts);

      // The query point sits anywhere inside its own cell, so scanning the
      // perimeter out to r only guarantees coverage out to r * cellSize.
      if (best.nearest && best.minDist <= r * this.cellSize) {
        isProven = true;
        break;
      }
    }

    // 2. Fallback exhaustive scan without heap allocation (iterating values directly)
    if (!isProven) {
      this._scanCellForNearest(this.nodes.values(), x, y, onlyGiant, best);
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
    const { startId, goalId, edgePenalties = new Map(), vehicleType = 'bike' } = options;
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
   * Finds optimal route plus alternative secondary routes with penalty factors.
   * Candidates are collected first, then sorted by totalTimeSeconds so the
   * fastest alternative always appears as Alternative 1, regardless of the
   * iteration order in which the penalty-based search discovered them.
   */
  public findRoutesWithAlternatives(options: FindAlternativesOptions): RouteResult[] {
    const { startId, goalId, maxRoutes = 3, vehicleType = 'bike' } = options;
    const candidates: RouteResult[] = [];
    const edgePenalties = new Map<string, number>();
    const acceptedEdgeSets: Set<string>[] = [];

    // Attempt up to maxRoutes * 2 searches to discover distinct alternatives
    for (let i = 0; i < maxRoutes * 2 && candidates.length < maxRoutes; i++) {
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
        candidates.push({ ...result });
      }

      // Penalize used edges for the next iteration to find alternative paths
      for (const edgeKey of candidateEdgeKeys) {
        const currentPenalty = edgePenalties.get(edgeKey) ?? 1.0;
        edgePenalties.set(edgeKey, currentPenalty * 3.5);
      }
    }

    // Sort by travel time so the genuinely fastest candidate is always first
    candidates.sort((a, b) => a.totalTimeSeconds - b.totalTimeSeconds);

    return candidates.map((candidate, idx) => ({
      ...candidate,
      index: idx + 1,
      isOptimal: idx === 0,
      label: idx === 0 ? 'Fastest Route' : `Alternative Route ${idx}`
    }));
  }
}
