/**
 * Route State Reducer for San Andreas Pathfinder 3D
 */

import type { RoadGraph } from '../../engine/RoadGraph';
import type { GtaCoords, RouteResult, RouteLeg } from '../../engine/types';
import { ElevationPhysics, type VehicleProfileType } from '../../terrain/ElevationPhysics';
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
  return letters[index] ?? `P${index + 1}`;
}

export interface ComputeRoutesOptions {
  waypoints: Waypoint[];
  graph: RoadGraph | null;
  vehicleType?: VehicleProfileType;
}

function computeRoutes(options: ComputeRoutesOptions): RouteResult[] {
  const { waypoints, graph, vehicleType = 'car' } = options;
  if (!graph || waypoints.length < 2) return [];

  // 2 Waypoints: Optimal + Alternatives with vehicle physics
  if (waypoints.length === 2) {
    const firstWp = waypoints[0];
    const secondWp = waypoints[1];
    if (!firstWp || !secondWp) return [];

    const start = firstWp.snapNode;
    const goal = secondWp.snapNode;
    return graph.findRoutesWithAlternatives({
      startId: start.id,
      goalId: goal.id,
      maxRoutes: 3,
      vehicleType
    });
  }

  // 3+ Waypoints: Multi-Stop Continuous Journey
  const pathNodes: import('../../engine/types').GraphNode[] = [];
  let totalDistance = 0;
  let totalTimeSeconds = 0;
  const usedEdges = [];
  const nodeIds = [];
  const legs: RouteLeg[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const startWp = waypoints[i];
    const goalWp = waypoints[i + 1];
    if (!startWp || !goalWp) continue;

    const start = startWp.snapNode;
    const goal = goalWp.snapNode;
    const leg = graph.findShortestPath({
      startId: start.id,
      goalId: goal.id,
      vehicleType
    });

    if (leg) {
      totalDistance += leg.totalDistance;
      totalTimeSeconds += leg.totalTimeSeconds;
      usedEdges.push(...leg.usedEdges);
      nodeIds.push(...leg.nodeIds);
      pathNodes.push(...leg.path);
      legs.push({
        fromIndex: i,
        toIndex: i + 1,
        fromLabel: startWp.label,
        toLabel: goalWp.label,
        path: leg.path,
        totalDistance: leg.totalDistance,
        totalTimeSeconds: leg.totalTimeSeconds
      });
    }
  }

  if (pathNodes.length === 0) return [];

  const elevationProfile = ElevationPhysics.calculateElevationProfile(pathNodes);
  const firstLabel = waypoints[0]?.label ?? 'A';
  const lastLabel = waypoints.at(-1)?.label ?? 'B';

  return [
    {
      path: pathNodes,
      nodeIds,
      totalDistance: Math.round(totalDistance),
      totalTimeSeconds: Math.round(totalTimeSeconds),
      elevationProfile,
      usedEdges,
      legs,
      isOptimal: true,
      label: `Total Route (${firstLabel} ➔ ${lastLabel})`
    }
  ];
}

export function routeReducer(state: RouteState, action: RouteAction): RouteState {
  switch (action.type) {
    case 'SET_GRAPH': {
      const graph = action.graph;
      const reSnappedWaypoints = state.waypoints.map(wp => {
        const snap = graph.findNearestNode({ x: wp.coords.x, y: wp.coords.y, onlyGiant: true }).node;
        return {
          ...wp,
          snapNode: snap || wp.snapNode
        };
      });
      const routes = computeRoutes({
        waypoints: reSnappedWaypoints,
        graph,
        vehicleType: state.vehicleType
      });
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
      const nearest = state.graph.findNearestNode({ x: action.coords.x, y: action.coords.y, onlyGiant: true });
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

      const routes = computeRoutes({
        waypoints,
        graph: state.graph,
        vehicleType: state.vehicleType
      });
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
      const routes = computeRoutes({
        waypoints,
        graph: state.graph,
        vehicleType: state.vehicleType
      });
      return {
        ...state,
        waypoints,
        routes,
        activeRouteIndex: 0
      };
    }

    case 'UPDATE_WAYPOINT': {
      if (!state.graph) return state;
      const nearest = state.graph.findNearestNode({ x: action.coords.x, y: action.coords.y, onlyGiant: true });
      if (!nearest.node) return state;

      const waypoints = state.waypoints.map((wp, i) => {
        if (i !== action.index) return wp;
        return {
          ...wp,
          coords: action.coords,
          snapNode: nearest.node ?? wp.snapNode
        };
      });

      const routes = computeRoutes({
        waypoints,
        graph: state.graph,
        vehicleType: state.vehicleType
      });
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
      const routes = computeRoutes({
        waypoints,
        graph: state.graph,
        vehicleType: state.vehicleType
      });
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
      const routes = computeRoutes({
        waypoints: state.waypoints,
        graph: state.graph,
        vehicleType
      });
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

      const graph = state.graph;
      const vehicle = action.vehicle ?? state.vehicleType;
      const waypoints: Waypoint[] = [];

      action.waypointsCoords.forEach((c, i) => {
        const snap = graph.findNearestNode({ x: c.x, y: c.y, onlyGiant: true }).node;
        if (snap) {
          waypoints.push({
            id: `wp_${i}`,
            label: getWaypointLabel(i),
            coords: c,
            snapNode: snap
          });
        }
      });

      const routes = computeRoutes({
        waypoints,
        graph,
        vehicleType: vehicle
      });
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
