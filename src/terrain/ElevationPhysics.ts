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
   * Smooth continuous speed multiplier based on road slope and vehicle profile
   */
  static getSlopeSpeedMultiplier(slope: number, vehicleType: VehicleProfileType = 'car'): number {
    const profile = VEHICLE_PROFILES[vehicleType] ?? VEHICLE_PROFILES.car;

    if (slope > 0) {
      // Uphill climb: speed decreases exponentially with slope and sensitivity
      // - At +5% grade: ~0.80x
      // - At +15% grade: ~0.50x
      // - At +30% grade: ~0.30x
      const penalty = Math.exp(-3.5 * slope * profile.slopeSensitivity);
      return Math.max(0.20, penalty * profile.nominalMultiplier);
    } else if (slope < 0) {
      // Downhill descent: slight inertia boost up to -15%, then braking required
      const absSlope = Math.abs(slope);
      if (absSlope <= 0.15) {
        return (1.0 + absSlope * 0.7) * profile.nominalMultiplier; // Up to ~1.10x
      } else {
        // Steep downhill requires braking for safety
        return Math.max(0.60, (1.10 - (absSlope - 0.15) * 1.5)) * profile.nominalMultiplier;
      }
    }

    return 1.0 * profile.nominalMultiplier;
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
