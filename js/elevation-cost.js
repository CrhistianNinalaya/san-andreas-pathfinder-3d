/**
 * 3D Elevation and Terrain Gradient Physics Module
 * 
 * Computes 3-dimensional Euclidean distances (X, Y, Z),
 * slope percentages (uphill/downhill gradient), and vehicles'
 * gravitational and powertrain speed impact.
 */

class ElevationPhysics {
  /**
   * 3D Euclidean distance between two nodes
   */
  static calculate3DDistance(nodeA, nodeB) {
    const dx = nodeA.x - nodeB.x;
    const dy = nodeA.y - nodeB.y;
    const dz = (nodeA.z || 0) - (nodeB.z || 0);
    return Math.hypot(dx, dy, dz);
  }

  /**
   * 2D horizontal map distance
   */
  static calculate2DDistance(nodeA, nodeB) {
    return Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
  }

  /**
   * Slope / Gradient between two nodes
   * @returns {number} Decimal gradient (e.g. +0.12 is +12% climb, -0.08 is -8% descent)
   */
  static calculateSlope(nodeA, nodeB) {
    const dist2D = this.calculate2DDistance(nodeA, nodeB);
    if (dist2D < 0.1) return 0;
    const dz = (nodeB.z || 0) - (nodeA.z || 0);
    return dz / dist2D;
  }

  /**
   * Speed multiplier factor based on road grade / slope.
   * 
   * Vehicle physics model:
   * - Flat terrain (-4% to +4%): 1.0x (Cruise speed)
   * - Moderate climb (+4% to +12%): 0.75x (Engine under load)
   * - Steep climb (+12% to +25%): 0.50x (Severe power drop on hills)
   * - Extreme mountain slope (> +25%): 0.30x (1st gear dirt tracks)
   * - Gentle downhill (-4% to -15%): 1.10x (Inertia & gravitational assist)
   * - Steep descent (< -15%): 0.85x (Braking required for safety)
   */
  static getSlopeSpeedMultiplier(slope) {
    if (slope > 0.25) {
      return 0.30;
    } else if (slope > 0.12) {
      return 0.50;
    } else if (slope > 0.04) {
      return 0.75;
    } else if (slope >= -0.04) {
      return 1.0;
    } else if (slope >= -0.15) {
      return 1.10;
    } else {
      return 0.85;
    }
  }

  /**
   * Evaluates complete segment metrics considering 3D distance and slope
   */
  static evaluateSegment(nodeA, nodeB, nominalSpeedKmH = 80) {
    const dist3D = this.calculate3DDistance(nodeA, nodeB);
    const slope = this.calculateSlope(nodeA, nodeB);
    const slopeMultiplier = this.getSlopeSpeedMultiplier(slope);

    const effectiveSpeedKmH = Math.max(15, nominalSpeedKmH * slopeMultiplier);
    const effectiveSpeedMps = (effectiveSpeedKmH * 1000) / 3600;
    const timeSeconds = dist3D / effectiveSpeedMps;

    return {
      distance3D: dist3D,
      slopePercent: Math.round(slope * 100),
      effectiveSpeedKmH: Math.round(effectiveSpeedKmH),
      timeSeconds,
      elevationDelta: (nodeB.z || 0) - (nodeA.z || 0)
    };
  }

  /**
   * Calculates overall elevation profile (elevation gain, loss, min/max altitude)
   */
  static calculateElevationProfile(pathNodes) {
    if (!pathNodes || pathNodes.length < 2) {
      return {
        elevationGain: 0,
        elevationLoss: 0,
        minElevation: pathNodes[0]?.z || 0,
        maxElevation: pathNodes[0]?.z || 0
      };
    }

    let elevationGain = 0;
    let elevationLoss = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;

    for (let i = 0; i < pathNodes.length; i++) {
      const z = pathNodes[i].z || 0;
      if (z < minElevation) minElevation = z;
      if (z > maxElevation) maxElevation = z;

      if (i > 0) {
        const prevZ = pathNodes[i - 1].z || 0;
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
