/**
 * Route State Reducer for San Andreas Pathfinder 3D
 */

import type { RoadGraph } from '../../engine/RoadGraph';
import type { GtaCoords, RouteResult } from '../../engine/types';
import type { VehicleProfileType } from '../../terrain/ElevationPhysics';
import type { Waypoint } from '../../map-bridge/useWaypointMarkers';

export interface RouteState {
  waypoints: Waypoint[];
  routes: RouteResult[];
  activeRouteIndex: number;
  vehicleType: VehicleProfileType;
  scope: 'all' | 'losSantos' | 'sanFierro' | 'lasVenturas' | 'countryside';
  graph: RoadGraph | null;
  isLoadingGraph: boolean;
  graphNodeCount: number;
}

export type RouteAction =
  | { type: 'SET_GRAPH'; graph: RoadGraph }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'ADD_WAYPOINT'; coords: GtaCoords }
  | { type: 'REMOVE_WAYPOINT'; index: number }
  | { type: 'UPDATE_WAYPOINT'; index: number; coords: GtaCoords }
  | { type: 'REVERSE_WAYPOINTS' }
  | { type: 'CLEAR_WAYPOINTS' }
  | { type: 'SET_VEHICLE'; vehicleType: VehicleProfileType }
  | { type: 'SET_SCOPE'; scope: RouteState['scope'] }
  | { type: 'SET_ACTIVE_ROUTE'; index: number }
  | { type: 'RESTORE_URL_WAYPOINTS'; waypointsCoords: GtaCoords[]; vehicle?: VehicleProfileType; altIndex?: number };

export const initialRouteState: RouteState = {
  waypoints: [],
  routes: [],
  activeRouteIndex: 0,
  vehicleType: 'car',
  scope: 'all',
  graph: null,
  isLoadingGraph: true,
  graphNodeCount: 0
};

function getWaypointLabel(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < letters.length) return letters[index]!;
  return `P${index + 1}`;
}

function computeRoutes(waypoints: Waypoint[], graph: RoadGraph | null, vehicleType: VehicleProfileType = 'car'): RouteResult[] {
  if (!graph || waypoints.length < 2) return [];

  // 2 Waypoints: Optimal + Alternatives with vehicle physics
  if (waypoints.length === 2) {
    const start = waypoints[0]!.snapNode;
    const goal = waypoints[1]!.snapNode;
    return graph.findRoutesWithAlternatives(start.id, goal.id, 3, vehicleType);
  }

  // 3+ Waypoints: Multi-Stop Continuous Journey
  const pathNodes: import('../../engine/types').GraphNode[] = [];
  let totalDistance = 0;
  let totalTimeSeconds = 0;
  const usedEdges = [];
  const nodeIds = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i]!.snapNode;
    const goal = waypoints[i + 1]!.snapNode;
    const leg = graph.findShortestPath(start.id, goal.id, new Map(), vehicleType);

    if (leg) {
      totalDistance += leg.totalDistance;
      totalTimeSeconds += leg.totalTimeSeconds;
      usedEdges.push(...leg.usedEdges);
      nodeIds.push(...leg.nodeIds);
      pathNodes.push(...leg.path);
    }
  }

  if (pathNodes.length === 0) return [];

  const elevationProfile = {
    elevationGain: 0,
    elevationLoss: 0,
    minElevation: Infinity,
    maxElevation: -Infinity
  };

  pathNodes.forEach((node, idx) => {
    if (node.z < elevationProfile.minElevation) elevationProfile.minElevation = node.z;
    if (node.z > elevationProfile.maxElevation) elevationProfile.maxElevation = node.z;
    if (idx > 0) {
      const diff = node.z - (pathNodes[idx - 1]?.z ?? 0);
      if (diff > 0) elevationProfile.elevationGain += diff;
      else elevationProfile.elevationLoss += Math.abs(diff);
    }
  });

  return [
    {
      path: pathNodes,
      nodeIds,
      totalDistance: Math.round(totalDistance),
      totalTimeSeconds: Math.round(totalTimeSeconds),
      elevationProfile,
      usedEdges,
      isOptimal: true,
      label: `Total Route (${waypoints[0]!.label} ➔ ${waypoints[waypoints.length - 1]!.label})`
    }
  ];
}

export function routeReducer(state: RouteState, action: RouteAction): RouteState {
  switch (action.type) {
    case 'SET_GRAPH': {
      const graph = action.graph;
      const reSnappedWaypoints = state.waypoints.map(wp => {
        const snap = graph.findNearestNode(wp.coords.x, wp.coords.y, true).node;
        return {
          ...wp,
          snapNode: snap || wp.snapNode
        };
      });

      const routes = computeRoutes(reSnappedWaypoints, graph, state.vehicleType);
      return {
        ...state,
        graph,
        isLoadingGraph: false,
        graphNodeCount: graph.nodes.size,
        waypoints: reSnappedWaypoints,
        routes,
        activeRouteIndex: 0
      };
    }

    case 'SET_LOADING':
      return { ...state, isLoadingGraph: action.isLoading };

    case 'ADD_WAYPOINT': {
      if (!state.graph) return state;
      const nearest = state.graph.findNearestNode(action.coords.x, action.coords.y, true);
      if (!nearest.node) return state;

      const newIndex = state.waypoints.length;
      const newWp: Waypoint = {
        id: `wp_${Date.now()}_${Math.random()}`,
        label: getWaypointLabel(newIndex),
        coords: action.coords,
        snapNode: nearest.node
      };

      const waypoints = [...state.waypoints, newWp];
      waypoints.forEach((wp, i) => {
        wp.label = getWaypointLabel(i);
      });

      const routes = computeRoutes(waypoints, state.graph, state.vehicleType);
      return {
        ...state,
        waypoints,
        routes,
        activeRouteIndex: 0
      };
    }

    case 'REMOVE_WAYPOINT': {
      const waypoints = state.waypoints.filter((_, i) => i !== action.index);
      waypoints.forEach((wp, i) => {
        wp.label = getWaypointLabel(i);
      });
      const routes = computeRoutes(waypoints, state.graph, state.vehicleType);
      return {
        ...state,
        waypoints,
        routes,
        activeRouteIndex: 0
      };
    }

    case 'UPDATE_WAYPOINT': {
      if (!state.graph) return state;
      const nearest = state.graph.findNearestNode(action.coords.x, action.coords.y, true);
      if (!nearest.node) return state;

      const waypoints = state.waypoints.map((wp, i) => {
        if (i !== action.index) return wp;
        return {
          ...wp,
          coords: action.coords,
          snapNode: nearest.node!
        };
      });

      const routes = computeRoutes(waypoints, state.graph, state.vehicleType);
      return {
        ...state,
        waypoints,
        routes,
        activeRouteIndex: 0
      };
    }

    case 'REVERSE_WAYPOINTS': {
      const waypoints = [...state.waypoints].reverse();
      waypoints.forEach((wp, i) => {
        wp.label = getWaypointLabel(i);
      });
      const routes = computeRoutes(waypoints, state.graph, state.vehicleType);
      return {
        ...state,
        waypoints,
        routes,
        activeRouteIndex: 0
      };
    }

    case 'CLEAR_WAYPOINTS':
      return {
        ...state,
        waypoints: [],
        routes: [],
        activeRouteIndex: 0
      };

    case 'SET_VEHICLE': {
      const vehicleType = action.vehicleType;
      const routes = computeRoutes(state.waypoints, state.graph, vehicleType);
      return {
        ...state,
        vehicleType,
        routes
      };
    }

    case 'SET_SCOPE':
      return { ...state, scope: action.scope };

    case 'SET_ACTIVE_ROUTE':
      return { ...state, activeRouteIndex: action.index };

    case 'RESTORE_URL_WAYPOINTS': {
      if (!state.graph || action.waypointsCoords.length === 0) return state;

      const vehicle = action.vehicle ?? state.vehicleType;
      const waypoints: Waypoint[] = action.waypointsCoords.map((c, i) => {
        const snap = state.graph!.findNearestNode(c.x, c.y, true).node!;
        return {
          id: `wp_${i}`,
          label: getWaypointLabel(i),
          coords: c,
          snapNode: snap
        };
      });

      const routes = computeRoutes(waypoints, state.graph, vehicle);
      return {
        ...state,
        waypoints,
        routes,
        vehicleType: vehicle,
        activeRouteIndex: action.altIndex ?? 0
      };
    }

    default:
      return state;
  }
}
