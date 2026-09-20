/**
 * Core Types for San Andreas Pathfinder 3D
 */

import type { VehicleProfileType } from '../terrain/ElevationPhysics';

export interface GtaCoords {
  x: number;
  y: number;
  z?: number;
}

/**
 * Categorization for community-defined nodes and custom road network overlays:
 * 
 * - `'shortcut'`: Urban or city shortcuts through parking lots, alleys, or plazas to bypass traffic lights/turns.
 * - `'offroad'`: Dirt paths, mountain trails, countryside dirt tracks, and canal drainages unmapped in NPC data.
 * - `'jump'`: Unique stunt jumps, ramp takeoffs, and cliff drops allowing rapid one-way elevation transitions.
 * - `'patch'`: Official network topology repairs bridging missing junctions or dead-ends in raw extracted data (e.g. Flint County tunnel).
 */
export type CustomNetworkType = 'shortcut' | 'offroad' | 'jump' | 'patch';

/**
 * In-memory representation of a node in the road network graph.
 */
export interface GraphNode {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  componentId: number;
  isGiantComponent: boolean;
  isCustom?: boolean;
  customType?: CustomNetworkType;
  color?: string;
  shortcutId?: number;
  pointIndex?: number;
  totalPoints?: number;
  colorToken?: string;
}

export interface GraphEdge {
  from: string | number;
  to: string | number;
  speed?: number;
  flags?: number;
  isCustom?: boolean;
  type?: CustomNetworkType;
  color?: string;
  description?: string;
}

export interface AdjacencyEdge {
  to: string;
  distance: number;
  slope: number;
  slopePercent: number;
  nominalSpeed: number;
  speed?: number;
  baseTimeSeconds?: number;
  isCustom?: boolean;
  type?: CustomNetworkType;
  color?: string;
  description?: string;
  oneWay?: boolean;
}

export interface RawDataset {
  nodes: Array<{
    id: number | string;
    x: number;
    y: number;
    z?: number;
    name?: string;
    color?: string;
    shortcutId?: number;
    pointIndex?: number;
    totalPoints?: number;
    colorToken?: string;
  }>;
  edges: Array<{ from: number | string; to: number | string; speed?: number; flags?: number; color?: string; description?: string; oneWay?: boolean }>;
}

export interface CustomEdge {
  from: number | string;
  to: number | string;
  speed?: number;
  type?: CustomNetworkType;
  color?: string;
  description?: string;
  oneWay?: boolean;
}

/**
 * Custom node definition from patches or shortcut layers.
 */
export interface CustomNode {
  id: number | string;
  x: number;
  y: number;
  z?: number;
  name?: string;
  isCustom?: boolean;
  customType?: CustomNetworkType;
  color?: string;
  shortcutId?: number;
  pointIndex?: number;
  totalPoints?: number;
  colorToken?: string;
}

export interface CustomNetworkDataset {
  version?: string;
  description?: string;
  nodes?: CustomNode[];
  edges?: CustomEdge[];
}

export interface ElevationProfile {
  elevationGain: number;
  elevationLoss: number;
  minElevation: number;
  maxElevation: number;
}

export interface RouteLeg {
  fromIndex: number;
  toIndex: number;
  fromLabel: string;
  toLabel: string;
  path: GraphNode[];
  totalDistance: number;
  totalTimeSeconds: number;
}

export interface RouteResult {
  path: GraphNode[];
  nodeIds: string[];
  totalDistance: number;
  totalTimeSeconds: number;
  elevationProfile: ElevationProfile;
  usedEdges: AdjacencyEdge[];
  legs?: RouteLeg[];
  index?: number;
  isOptimal?: boolean;
  label?: string;
}

export interface NearestNodeResult {
  node: GraphNode | null;
  distance: number;
}

export interface SegmentEvaluation {
  distance3D: number;
  slopePercent: number;
  effectiveSpeedKmH: number;
  timeSeconds: number;
  elevationDelta: number;
}

/* Options interfaces for functions taking > 2 properties */

export interface FindNearestOptions {
  x: number;
  y: number;
  onlyGiant?: boolean;
}

export interface FindPathOptions {
  startId: string | number;
  goalId: string | number;
  edgePenalties?: Map<string, number>;
  vehicleType?: VehicleProfileType;
}

export interface FindAlternativesOptions {
  startId: string | number;
  goalId: string | number;
  maxRoutes?: number;
  vehicleType?: VehicleProfileType;
}

export interface EvaluateSegmentOptions {
  nodeA: GtaCoords;
  nodeB: GtaCoords;
  nominalSpeedKmH?: number;
  vehicleType?: VehicleProfileType;
}
