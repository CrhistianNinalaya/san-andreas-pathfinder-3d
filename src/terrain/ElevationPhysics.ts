/**
 * 3D Elevation and Terrain Gradient Physics Module
 */

import type { GtaCoords, SegmentEvaluation, ElevationProfile } from '../engine/types';

export type VehicleProfileType = 'car' | 'sports' | 'bike' | 'truck' | 'offroad';

export interface VehicleProfile {
  id: VehicleProfileType;
  name: string;
  nominalMultiplier: number;
  slopeSensitivity: number; // Factor scaling the uphill penalty
}

export const VEHICLE_PROFILES: Record<VehicleProfileType, VehicleProfile> = {
  car: {
    id: 'car',
    name: 'Car / Standard',
    nominalMultiplier: 1.0,
    slopeSensitivity: 1.0
  },
  sports: {
    id: 'sports',
    name: 'Sports Car',
    nominalMultiplier: 1.15,
    slopeSensitivity: 1.3 // More penalized on rough/steep climbs
  },
  bike: {
    id: 'bike',
    name: 'Motorcycle',
    nominalMultiplier: 0.95,
    slopeSensitivity: 0.5 // Agile on hills
  },
  truck: {
    id: 'truck',
    name: 'Truck / Heavy',
    nominalMultiplier: 0.70,
    slopeSensitivity: 2.0 // Heavily penalized on climbs
  },
  offroad: {
    id: 'offroad',
    name: 'Off-Road / 4x4',
    nominalMultiplier: 0.85,
    slopeSensitivity: 0.2 // Minimal climb penalty
  }
};

/** Exponential decay rate of the uphill climb penalty */
const UPHILL_DECAY = 3.5;
/** Slope at which the downhill inertia boost peaks and braking starts to dominate */
const DOWNHILL_INERTIA_LIMIT = 0.15;
/** Speed gained per unit of downhill slope while coasting */
const DOWNHILL_INERTIA_GAIN = 0.7;
/** Speed lost per unit of downhill slope once braking is required */
const DOWNHILL_BRAKING_LOSS = 1.5;
/** Floors on the terrain response, as a fraction of the road's nominal speed */
const MIN_UPHILL_RESPONSE = 0.2;
const MIN_DOWNHILL_RESPONSE = 0.6;

/**
 * Largest value the terrain response can take, reached at exactly
 * DOWNHILL_INERTIA_LIMIT. Derived from the constants above rather than written
 * out, so the A* heuristic's speed ceiling in RoadGraph cannot drift away from
 * the physics it is supposed to bound.
 */
export const MAX_SLOPE_SPEED_MULTIPLIER = 1 + DOWNHILL_INERTIA_LIMIT * DOWNHILL_INERTIA_GAIN;

export class ElevationPhysics {
  /**
   * 3D Euclidean distance between two points (X, Y, Z)
   */
  static calculate3DDistance(nodeA: GtaCoords, nodeB: GtaCoords): number {
    const dx = nodeA.x - nodeB.x;
    const dy = nodeA.y - nodeB.y;
    const dz = (nodeA.z ?? 0) - (nodeB.z ?? 0);
    return Math.hypot(dx, dy, dz);
  }

  /**
   * 2D horizontal map distance
   */
  static calculate2DDistance(nodeA: GtaCoords, nodeB: GtaCoords): number {
    return Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
  }

  /**
   * Slope gradient between two nodes (dz / dist2D)
   * @returns decimal slope (e.g. +0.12 = +12% climb, -0.08 = -8% descent)
   */
  static calculateSlope(nodeA: GtaCoords, nodeB: GtaCoords): number {
    const dist2D = this.calculate2DDistance(nodeA, nodeB);
    if (dist2D < 0.1) return 0;
    const dz = (nodeB.z ?? 0) - (nodeA.z ?? 0);
    return dz / dist2D;
  }

  /**
   * Terrain-only speed response, as a fraction of the road's nominal speed.
   *
   * Kept independent of the vehicle's nominalMultiplier so that both floors
   * mean the same thing: MIN_UPHILL_RESPONSE and MIN_DOWNHILL_RESPONSE are
   * each a share of the road speed, for every vehicle.
   *
   * Uphill, with a sensitivity of 1:
   * - At +5% grade: ~0.84x
   * - At +15% grade: ~0.59x
   * - At +30% grade: ~0.35x
   */
  private static getSlopeResponse(slope: number, slopeSensitivity: number): number {
    if (slope > 0) {
      // Uphill climb: speed decreases exponentially with slope and sensitivity
      const penalty = Math.exp(-UPHILL_DECAY * slope * slopeSensitivity);
      return Math.max(MIN_UPHILL_RESPONSE, penalty);
    }

    if (slope < 0) {
      // Downhill descent: slight inertia boost up to the limit, then braking
      const absSlope = Math.abs(slope);
      if (absSlope <= DOWNHILL_INERTIA_LIMIT) {
        return 1 + absSlope * DOWNHILL_INERTIA_GAIN;
      }
      // Steep downhill requires braking for safety, continuous with the branch
      // above because it starts from the same peak value
      const braked = MAX_SLOPE_SPEED_MULTIPLIER - (absSlope - DOWNHILL_INERTIA_LIMIT) * DOWNHILL_BRAKING_LOSS;
      return Math.max(MIN_DOWNHILL_RESPONSE, braked);
    }

    return 1;
  }

  /**
   * Smooth continuous speed multiplier based on road slope and vehicle profile
   */
  static getSlopeSpeedMultiplier(slope: number, vehicleType: VehicleProfileType = 'car'): number {
    const profile = VEHICLE_PROFILES[vehicleType] ?? VEHICLE_PROFILES.car;
    return this.getSlopeResponse(slope, profile.slopeSensitivity) * profile.nominalMultiplier;
  }

  /**
   * Evaluates complete road segment metrics considering 3D distance and slope
   */
  static evaluateSegment({
    nodeA,
    nodeB,
    nominalSpeedKmH = 80,
    vehicleType = 'car'
  }: import('../engine/types').EvaluateSegmentOptions): SegmentEvaluation {
    const dist3D = this.calculate3DDistance(nodeA, nodeB);
    const slope = this.calculateSlope(nodeA, nodeB);
    const slopeMultiplier = this.getSlopeSpeedMultiplier(slope, vehicleType);

    const effectiveSpeedKmH = Math.max(5, nominalSpeedKmH * slopeMultiplier);
    const effectiveSpeedMps = (effectiveSpeedKmH * 1000) / 3600;
    const timeSeconds = dist3D / effectiveSpeedMps;

    return {
      distance3D: dist3D,
      slopePercent: Math.round(slope * 100),
      effectiveSpeedKmH: Math.round(effectiveSpeedKmH),
      timeSeconds,
      elevationDelta: (nodeB.z ?? 0) - (nodeA.z ?? 0)
    };
  }

  /**
   * Calculates overall trip elevation profile (gain, loss, min/max altitude)
   */
  static calculateElevationProfile(pathNodes: Array<{ z?: number }>): ElevationProfile {
    if (!pathNodes || pathNodes.length < 2) {
      const z = pathNodes[0]?.z ?? 0;
      return {
        elevationGain: 0,
        elevationLoss: 0,
        minElevation: z,
        maxElevation: z
      };
    }

    let elevationGain = 0;
    let elevationLoss = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;

    for (let i = 0; i < pathNodes.length; i++) {
      const z = pathNodes[i]?.z ?? 0;
      if (z < minElevation) minElevation = z;
      if (z > maxElevation) maxElevation = z;

      if (i > 0) {
        const prevZ = pathNodes[i - 1]?.z ?? 0;
        const diff = z - prevZ;
        if (diff > 0) elevationGain += diff;
        else elevationLoss += Math.abs(diff);
      }
    }

    return {
      elevationGain: Math.round(elevationGain),
      elevationLoss: Math.round(elevationLoss),
      minElevation: Math.round(minElevation),
      maxElevation: Math.round(maxElevation)
    };
  }
}
