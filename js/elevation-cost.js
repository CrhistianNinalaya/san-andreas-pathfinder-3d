/**
 * Módulo de Física de Elevación y Desnivel de Terreno (3D)
 * 
 * Calcula distancias euclidianas tridimensionales (X, Y, Z),
 * pendientes porcentuales de subida/bajada y el impacto de la gravedad
 * y potencia del motor en el tiempo de viaje.
 */

class ElevationPhysics {
  /**
   * Distancia euclidiana 3D real entre dos puntos
   */
  static calculate3DDistance(nodeA, nodeB) {
    const dx = nodeA.x - nodeB.x;
    const dy = nodeA.y - nodeB.y;
    const dz = (nodeA.z || 0) - (nodeB.z || 0);
    return Math.hypot(dx, dy, dz);
  }

  /**
   * Distancia 2D horizontal en el plano del mapa
   */
  static calculate2DDistance(nodeA, nodeB) {
    return Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
  }

  /**
   * Pendiente / Desnivel porcentual entre dos nodos
   * @returns {number} Pendiente decimal (ej. +0.12 es +12% de subida, -0.08 es -8% de bajada)
   */
  static calculateSlope(nodeA, nodeB) {
    const dist2D = this.calculate2DDistance(nodeA, nodeB);
    if (dist2D < 0.1) return 0;
    const dz = (nodeB.z || 0) - (nodeA.z || 0);
    return dz / dist2D;
  }

  /**
   * Factor multiplicador de velocidad según la inclinación del terreno.
   * 
   * Modelo físico vehicular:
   * - Terreno plano (-3% a +3%): Factor 1.0 (Velocidad normal de crucero)
   * - Subida moderada (+3% a +10%): Factor 0.85 (El motor empieza a esforzarse)
   * - Subida empinada (+10% a +25%): Factor 0.50 a 0.35 (Pérdida severa de velocidad)
   * - Subida extrema (> +25%): Factor 0.25 (Pistas de montaña en 1ª marcha)
   * - Bajada moderada (-3% a -10%): Factor 1.10 (Asistencia gravitacional / inercia)
   * - Bajada empinada (< -15%): Factor 0.80 (El conductor frena por control)
   */
  static getSlopeSpeedMultiplier(slope) {
    if (slope > 0.25) {
      // Cuesta extrema (> 25%)
      return 0.30;
    } else if (slope > 0.12) {
      // Cuesta muy empinada (12% a 25%)
      return 0.50;
    } else if (slope > 0.04) {
      // Cuesta moderada (4% a 12%)
      return 0.75;
    } else if (slope >= -0.04) {
      // Plano (-4% a +4%)
      return 1.0;
    } else if (slope >= -0.15) {
      // Bajada suave/favorable (-4% a -15%)
      return 1.10;
    } else {
      // Bajada pronunciada (< -15%), requiere frenado
      return 0.85;
    }
  }

  /**
   * Calcula el coste completo de un tramo vial considerando 3D y pendiente
   */
  static evaluateSegment(nodeA, nodeB, nominalSpeedKmH = 80) {
    const dist3D = this.calculate3DDistance(nodeA, nodeB);
    const slope = this.calculateSlope(nodeA, nodeB);
    const slopeMultiplier = this.getSlopeSpeedMultiplier(slope);

    // Velocidad real efectiva en km/h
    const effectiveSpeedKmH = Math.max(15, nominalSpeedKmH * slopeMultiplier);
    const effectiveSpeedMps = (effectiveSpeedKmH * 1000) / 3600;

    // Tiempo real en segundos para cruzar este tramo
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
   * Calcula el perfil altimétrico completo de una ruta (desnivel positivo y negativo)
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
