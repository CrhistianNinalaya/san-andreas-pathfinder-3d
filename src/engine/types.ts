/**
 * Core Types for San Andreas Pathfinder 3D
 */

export interface GtaCoords {
  x: number;
  y: number;
  z?: number;
}

export interface GraphNode {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  componentId: number;
  isGiantComponent: boolean;
}

export interface GraphEdge {
  from: string | number;
  to: string | number;
  speed?: number;
  flags?: number;
}

export interface AdjacencyEdge {
  to: string;
  distance: number;
  slope: number;
  slopePercent: number;
  nominalSpeed: number;
}

export interface RawDataset {
  nodes: Array<{ id: number | string; x: number; y: number; z?: number; name?: string }>;
  edges: Array<{ from: number | string; to: number | string; speed?: number; flags?: number }>;
}

export interface ElevationProfile {
  elevationGain: number;
  elevationLoss: number;
  minElevation: number;
  maxElevation: number;
}

export interface RouteResult {
  path: GraphNode[];
  nodeIds: string[];
  totalDistance: number;
  totalTimeSeconds: number;
  elevationProfile: ElevationProfile;
  usedEdges: AdjacencyEdge[];
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
